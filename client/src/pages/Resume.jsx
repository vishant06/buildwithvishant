import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileX } from "lucide-react";
import { Link } from "react-router-dom";
import { absoluteAsset } from "../services/api";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
//   "pdfjs-dist/build/pdf.worker.min.mjs",
//   import.meta.url
// ).toString();


const Resume = () => {
  const [resume, setResume] = useState("");
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(800);

  useEffect(() => {
    const loadResume = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/resume/latest`
        );

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        console.log("API fileUrl:", data.fileUrl);
console.log("Resume URL:", absoluteAsset(data.fileUrl));

        setResume(absoluteAsset(data.fileUrl));
      } catch (err) {
        setResume("");
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, []);


  useEffect(() => {
  const updateWidth = () => {
    const width = Math.min(window.innerWidth - 20, 900);
    setPageWidth(width);
  };

  updateWidth(); // Initial width set karega

  window.addEventListener("resize", updateWidth);

  return () => {
    window.removeEventListener("resize", updateWidth);
  };
}, []);

  return (
    <section className="resume-page">

      <div className="resume-toolbar">
        <Link to="/" className="btn secondary">
          <ArrowLeft size={18} />
          Back
        </Link>

        {resume && (
          <a href={resume} download className="btn primary">
            <Download size={18} />
            Download Resume
          </a>
        )}
      </div>

      {loading ? (
        <p>Loading Resume...</p>
      ) : resume ? (
<div className="pdf-wrapper">
  <Document
    file={resume}
    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    loading={<p>Loading Resume...</p>}
  >
    {Array.from(new Array(numPages), (_, index) => (
      <Page
        key={`page_${index + 1}`}
        pageNumber={index + 1}
        width={pageWidth}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    ))}
  </Document>
</div>
      ) : (
        <div className="resume-empty">
          <FileX size={60} />
          <h2>No Resume Available</h2>
          <p>The resume hasn't been uploaded yet. Please check back later.</p>
        </div>
      )}
    </section>
  );
};

export default Resume;