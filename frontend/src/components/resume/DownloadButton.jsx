import { FiDownload } from "react-icons/fi";
import { useReactToPrint } from "react-to-print";
import api from "../../utils/axios";
import { useCoins } from "../../api/user.api";




export default function DownloadButton({
  resumeRef,
  user,
  setUser,
}) {

  const handlePrint = useReactToPrint({
    contentRef: resumeRef,
    documentTitle: "Fresher.AI",
  });

  const handleDownload = async () => {
    try {

      // Deduct 10 Coins
      const response = await useCoins( {
          coins: 10,
          action: "resume-builder",
        })

      if (!response?.success) {
        return alert(response?.message || "Couldn't reach the server. Is the backend running?");
      }

      // Update User Coins
      setUser((prev) => ({
        ...prev,
        interviewCoin: response.interviewCoin,
      }));

      // Download PDF
      handlePrint();

    } catch (error) {

      if (error.response?.status === 403) {
        return alert("Not enough Interview Coins.");
      }

      alert(
        error.response?.data?.message ||
        "Something went wrong."
      );
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 rounded-lg bg-black px-3 py-3 text-xs text-white"
    >
      <FiDownload />
      Download PDF
    </button>
  );
}