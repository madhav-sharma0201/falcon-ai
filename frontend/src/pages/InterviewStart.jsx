import Step1SetUp from "../components/interview/Step1SetUp";

function InterviewStart({ user, setUser }) {
  return (
    <Step1SetUp
      user={user}
      setUser={setUser}
    />
  );
}

export default InterviewStart;