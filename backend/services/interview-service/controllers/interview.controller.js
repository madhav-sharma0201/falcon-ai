import Interview from "../model/interview.model.js";
import graph from "../graph/graph.js";
import redis from "../../../shared/redis/redis.js";
import { gradeAptitudeAnswer, buildAptitudeReport } from "../utils/aptitude.js";
import { executeCode as execute } from "../configs/executor.js";

// The MCQ answer key lives on the question document. Strip it from anything
// sent to the browser while the interview is still running, otherwise the
// answers are one devtools request away.
const sanitiseQuestion = (q) => {
  if (!q) return q;
  const plain = typeof q.toObject === "function" ? q.toObject() : { ...q };
  delete plain.answerIndex;
  delete plain.explanation;
  return plain;
};
export const startInterview = async (req, res) => {
  try {

    const userId = req.headers["x-user-id"];

    const {
      type,
      role,
      useResume = false,
      resume = {},
    } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Interview type is required",
      });
    }

    // A target role is only genuinely required when we have no other way to
    // work out what to ask about:
    //   - aptitude  : identical for every role by design
    //   - useResume : the resume itself says what this candidate does
    const isAptitude = type === "aptitude";
    const typedRole = (role || "").trim();

    // Set when the role came from the resume rather than the user. The prompt
    // uses this to ground questions in the candidate's own projects and
    // skills, instead of asking generic questions for a role they never typed.
    const roleFromResume = !typedRole && useResume && !!resume?.suggestedRole;

    const resolvedRole =
      typedRole ||
      (isAptitude ? "General" : "") ||
      (roleFromResume ? String(resume.suggestedRole).trim() : "");

    if (!resolvedRole) {
      return res.status(400).json({
        success: false,
        message: useResume
          ? "Add a target role, or upload a resume so questions can be based on it."
          : "Target role is required for this interview type",
      });
    }

    // -----------------------------
    // LangGraph
    // -----------------------------

    const result = await graph.invoke({

      action: "start",

      type,

      role: resolvedRole,

      roleFromResume,

      useResume,

      resume,

    });

    const questions = result.questions;

    if (!questions || questions.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate interview questions",
      });
    }

    // -----------------------------
    // Create Interview
    // -----------------------------

    const interview = await Interview.create({

      userId,

      type,

      role: resolvedRole,

      useResume,

      questions,

      currentQuestion: 0,

      status: "in-progress",

    });


    await redis.del(`interviews:${userId}`);

    // -----------------------------
    // Response
    // -----------------------------

    return res.status(201).json({

      success: true,

      interviewId: interview._id,

      type: interview.type,

      currentQuestion: 0,

      totalQuestions: interview.questions.length,

      question: sanitiseQuestion(interview.questions[0]),

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }
};


export const submitAnswer = async (req, res) => {
  try {

    const userId = req.headers["x-user-id"];

    // Destructuring req.body directly threw a 500 on a body-less request,
    // which is exactly what a stray Ctrl+Enter used to send.
    const { interviewId, answer } = req.body || {};

    if (!interviewId || !answer) {
      return res.status(400).json({
        success: false,
        message: "Interview Id and Answer are required",
      });
    }

    // -----------------------------------
    // Find Interview
    // -----------------------------------

    const interview = await Interview.findOne({
      _id: interviewId,
      userId,
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    // -----------------------------------
    // Already Completed
    // -----------------------------------

    if (interview.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Interview already completed",
      });
    }

    // -----------------------------------
    // Current Question
    // -----------------------------------

    const index = interview.currentQuestion;

    const currentQuestion = interview.questions[index];

    if (!currentQuestion) {
      return res.status(400).json({
        success: false,
        message: "Invalid question index",
      });
    }

    // -----------------------------------
    // Save User Answer
    // -----------------------------------

    currentQuestion.userAnswer = answer;

    // -----------------------------------
    // Check Last Question
    // -----------------------------------

    const completed =
      interview.currentQuestion + 1 >=
      interview.questions.length;

    // -----------------------------------
    // Aptitude: graded locally, no LLM
    // -----------------------------------

    if (interview.type === "aptitude") {

      const { feedback } = gradeAptitudeAnswer(currentQuestion, answer);

      currentQuestion.feedback = feedback;

      interview.currentQuestion++;

      if (completed) {

        const report = buildAptitudeReport(interview.questions);

        interview.status = "completed";
        interview.overallScore = report.overallScore;
        interview.summary = report.summary;
        interview.strengths = report.strengths;
        interview.weaknesses = report.weaknesses;
        interview.recommendations = report.recommendations;

        await interview.save();
        await redis.del(`interviews:${userId}`);

        return res.status(200).json({
          success: true,
          completed: true,
          interview,
        });

      }

      await interview.save();
      await redis.del(`interviews:${userId}`);

      return res.status(200).json({

        success: true,

        completed: false,

        currentQuestion: interview.currentQuestion,

        question: sanitiseQuestion(
          interview.questions[interview.currentQuestion]
        ),

        feedback,

      });

    }

    // -----------------------------------
    // LangGraph
    // -----------------------------------

    const result = await graph.invoke({

      action: "feedback",

      question: currentQuestion.question,

      answer,

      difficulty: currentQuestion.difficulty,

      completed,

      role: interview.role,

      type: interview.type,

      questions: interview.questions,

    });

    // -----------------------------------
    // Save Feedback
    // -----------------------------------

    currentQuestion.feedback = result.feedback;

    interview.currentQuestion++;

    // -----------------------------------
    // Completed
    // -----------------------------------

    if (completed) {

      interview.status = "completed";

      interview.overallScore =
        result.report.overallScore;

      interview.summary =
        result.report.summary;

      interview.strengths =
        result.report.strengths;

      interview.weaknesses =
        result.report.weaknesses;

      interview.recommendations =
        result.report.recommendations;

      await interview.save();

      await redis.del(`interviews:${userId}`);

      return res.status(200).json({

        success: true,

        completed: true,

        interview,

      });

    }

    // -----------------------------------
    // Save Progress
    // -----------------------------------

    await interview.save();

    await redis.del(`interviews:${userId}`);

    return res.status(200).json({

      success: true,

      completed: false,

      currentQuestion: interview.currentQuestion,

      question:
        interview.questions[
        interview.currentQuestion
        ],

      feedback: result.feedback,

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }
};



export const runCode = async (req, res) => {
  try {

    const { language, code, stdin } = req.body || {};

    if (!language || !code) {
      return res.status(400).json({
        success: false,
        message: "Language and code are required",
      });
    }

    const result = await execute({ language, code, stdin });

    // A failing program is a successful request — the candidate needs to see
    // the compiler error, so this is 200 with the detail in the body.
    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


export const getInterview = async (req, res) => {
  try {

    const userId = req.headers["x-user-id"];

    const { id } = req.params;

    const interview = await Interview.findOne({
      _id: id,
      userId,
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    // While the test is running the answer key must not go out — a refresh
    // would otherwise reveal every remaining answer. Once completed, the
    // explanations are the whole point of the report, so they're included.
    if (interview.status !== "completed") {
      const safe = interview.toObject();
      safe.questions = safe.questions.map(sanitiseQuestion);
      return res.status(200).json({
        success: true,
        interview: safe,
      });
    }

    return res.status(200).json({
      success: true,
      interview,
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


export const getAllInterviews = async (req, res) => {
  try {

    const userId = req.headers["x-user-id"];

    const cacheKey = `interviews:${userId}`;

    // -----------------------------
    // Redis Cache
    // -----------------------------

    const cache = await redis.get(cacheKey);

    if (cache) {

      console.log("✅ Data served from Redis");

      return res.status(200).json(
        JSON.parse(cache)
      );

    }



    // -----------------------------
    // MongoDB
    // -----------------------------
    const interviews = await Interview.find({
      userId,
    }).sort({
      createdAt: -1,
    });


    // -----------------------------
    // Dashboard Stats
    // -----------------------------

    const completed = interviews.filter(
      (item) => item.status === "completed"
    );

    const totalQuestions = interviews.reduce(
      (sum, item) => sum + item.questions.length,
      0
    );

    const averageScore =
      completed.length > 0
        ? Number(
          (
            completed.reduce(
              (sum, item) => sum + item.overallScore,
              0
            ) / completed.length
          ).toFixed(1)
        )
        : 0;

    const stats = {

      totalInterviews: interviews.length,

      totalQuestions,

      completed: completed.length,

      averageScore,

    };

    // -----------------------------
    // Graph Average
    // -----------------------------

    const getAverageData = (list) => {

      if (!list.length) {
        return [
          { skill: "Correctness", score: 0 },
          { skill: "Clarity", score: 0 },
          { skill: "Relevance", score: 0 },
          { skill: "Detail", score: 0 },
          { skill: "Efficiency", score: 0 },
          { skill: "Communication", score: 0 },
          { skill: "Problem solving", score: 0 },
          { skill: "Creativity", score: 0 },
        ];
      }

      const total = {
        correctness: 0,
        clarity: 0,
        relevance: 0,
        detail: 0,
        efficiency: 0,
        communication: 0,
        problemSolving: 0,
        creativity: 0,
      };

      list.forEach((interview) => {

        interview.questions.forEach((q) => {

          total.correctness += q.feedback.correctness || 0;
          total.clarity += q.feedback.clarity || 0;
          total.relevance += q.feedback.relevance || 0;
          total.detail += q.feedback.detail || 0;
          total.efficiency += q.feedback.efficiency || 0;
          total.communication += q.feedback.communication || 0;
          total.problemSolving += q.feedback.problemSolving || 0;
          total.creativity += q.feedback.creativity || 0;

        });

      });

      const count = list.reduce(
        (sum, item) => sum + item.questions.length,
        0
      );


      if (count === 0) {
        return [
          { skill: "Correctness", score: 0 },
          { skill: "Clarity", score: 0 },
          { skill: "Relevance", score: 0 },
          { skill: "Detail", score: 0 },
          { skill: "Efficiency", score: 0 },
          { skill: "Communication", score: 0 },
          { skill: "Problem solving", score: 0 },
          { skill: "Creativity", score: 0 },
        ];
      }


      return [

        {
          skill: "Correctness",
          score: Math.round(total.correctness / count),
        },

        {
          skill: "Clarity",
          score: Math.round(total.clarity / count),
        },

        {
          skill: "Relevance",
          score: Math.round(total.relevance / count),
        },

        {
          skill: "Detail",
          score: Math.round(total.detail / count),
        },

        {
          skill: "Efficiency",
          score: Math.round(total.efficiency / count),
        },

        {
          skill: "Communication",
          score: Math.round(total.communication / count),
        },

        {
          skill: "Problem solving",
          score: Math.round(total.problemSolving / count),
        },

        {
          skill: "Creativity",
          score: Math.round(total.creativity / count),
        },

      ];

    };


    const technicalInterviews = completed.filter(
      (item) => item.type === "technical"
    );

    const behaviouralInterviews = completed.filter(
      (item) => item.type === "hr"
    );

    const technicalData =
      getAverageData(technicalInterviews);

    const behaviouralData =
      getAverageData(behaviouralInterviews);


    const technicalCount = technicalInterviews.length;
    const hrCount = behaviouralInterviews.length;

    const payload = {

      success: true,

      interviews,

      stats,

      technicalData,

      behaviouralData,
      technicalCount,
      hrCount,

    };

    await redis.set(
      cacheKey,
      JSON.stringify(payload),
      "EX",
      600
    );



    return res.status(200).json(payload);

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }
};