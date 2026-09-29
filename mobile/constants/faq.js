// Mirrors client/src/components/AboutFaqSection.jsx's aboutFaqItems — same
// content, source of truth is the web copy. Kept in plain text / string
// arrays here since the web version's JSX (inline links, chips) doesn't
// translate directly to native components.
export const ABOUT_FAQ_ITEMS = [
  {
    id: "about-what-is",
    question: "What is BuildWithVishant?",
    answer:
      "BuildWithVishant is a developer platform and programming learning website, not just a personal portfolio page. It brings together programming notes, hands-on coding practice, and AI-assisted learning so that studying a concept and actually writing code stay connected. It's built and maintained by Vishant Kumar as an ongoing, developer-focused project.",
  },
  {
    id: "about-what-can-you-do",
    question: "What can you do on BuildWithVishant?",
    answer: [
      "Programming notes — structured notes covering languages, frameworks and core computer-science concepts.",
      "An in-browser code playground — write and run code across 20+ languages, no local setup required.",
      "An AI learning assistant — ask questions about React, JavaScript, Node.js, MongoDB or get code explained line by line.",
      "Projects — a running record of real MERN stack projects.",
    ],
  },
  {
    id: "about-why",
    question: "Why does BuildWithVishant exist?",
    answer:
      "Most programming tutorials stop at explaining a concept. Turning that into a habit of writing, running and debugging code usually means switching tools or hunting for a second resource just to practice. BuildWithVishant closes that gap — pairing programming notes with a playground that runs code instantly.",
  },
  {
    id: "about-who-for",
    question: "Who is BuildWithVishant built for?",
    answer: [
      "Students learning programming for the first time",
      "Beginners looking for structured, readable programming notes",
      "Developers who want a fast place to practice or test code",
      "Software and web developers exploring new languages in the playground",
      "Anyone who prefers learning by reading and then immediately practicing",
    ],
  },
  {
    id: "about-loop",
    question: "How does the learn, practice and build loop work?",
    answer:
      "Read a programming note to understand a concept, open the playground to write and run code that applies it, and lean on the AI assistant when something isn't clicking. Over time, that practice turns into real coding projects.",
  },
  {
    id: "about-tech",
    question: "What technology powers BuildWithVishant?",
    answer:
      "BuildWithVishant is built with the modern web stack it teaches: React.js and Vite on the front end, Node.js and Express.js on the backend, and MongoDB for data storage. The playground runs on the Monaco editor — the same engine behind Visual Studio Code.",
  },
  {
    id: "about-vision",
    question: "What's the vision for BuildWithVishant?",
    answer:
      "The long-term goal is to keep growing as a practical, developer-focused learning and coding platform — expanding the notes library, refining the playground, and improving the AI assistant.",
  },
  {
    id: "about-vishant",
    question: "Who built BuildWithVishant?",
    answer:
      "BuildWithVishant was created and is developed by Vishant Kumar, a Full Stack MERN Developer and B.Tech Information Technology student at SCRIET, Chaudhary Charan Singh University, Meerut. His work centers on React.js, Node.js, Express.js, MongoDB and JavaScript, alongside regular Data Structures & Algorithms practice in Java.",
  },
];
