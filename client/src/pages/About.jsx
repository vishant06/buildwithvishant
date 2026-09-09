import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader.jsx";
import Seo from "../components/Seo.jsx";

const SITE_URL = "https://www.buildwithvishant.in";

const interests = [
  "MERN Stack Development",
  "Programming",
  "Badminton",
  "Learning New Technologies",
  "Data Structures & Algorithms",
];

const platformFeatures = [
  {
    title: "Programming notes",
    body: (
      <>
        Structured <Link to="/notes">programming notes</Link> covering
        languages, frameworks and core computer-science concepts — written to
        be read as a learning resource, not just a reference dump.
      </>
    ),
  },
  {
    title: "An in-browser code playground",
    body: (
      <>
        A real <Link to="/playground">coding playground</Link> for writing
        and running code across 20+ languages, including JavaScript, Python,
        Java, C++, Go and SQL — with no local setup required, so you can
        practice programming the moment an idea comes to mind.
      </>
    ),
  },
  {
    title: "An AI learning assistant",
    body: (
      <>
        A built-in <Link to="/assistant">AI assistant</Link> for asking
        questions about React, JavaScript, Node.js, MongoDB and general web
        development, or for getting an unfamiliar block of code explained
        line by line.
      </>
    ),
  },
  {
    title: "Projects and resume",
    body: (
      <>
        A running record of real <Link to="/projects">MERN stack projects</Link>{" "}
        and an up-to-date <Link to="/resume">resume</Link>, so the platform
        also doubles as a transparent look at the software development work
        behind it.
      </>
    ),
  },
];

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about#webpage`,
      url: `${SITE_URL}/about`,
      name: "About BuildWithVishant",
      description:
        "BuildWithVishant is a developer platform by Vishant Kumar offering programming notes, an in-browser code playground, and an AI learning assistant for students and developers.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "BuildWithVishant",
      description:
        "A developer learning platform offering programming notes, an in-browser code playground and an AI learning assistant.",
    },
    {
      "@type": ["Organization", "EducationalOrganization"],
      "@id": `${SITE_URL}/#organization`,
      name: "BuildWithVishant",
      url: SITE_URL,
      founder: { "@id": `${SITE_URL}/#vishant` },
      description:
        "Developer platform providing programming notes, an online code playground and AI-assisted learning for students and developers.",
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#vishant`,
      name: "Vishant Kumar",
      url: SITE_URL,
      jobTitle: "Full Stack MERN Developer",
      knowsAbout: [
        "React.js",
        "Node.js",
        "Express.js",
        "MongoDB",
        "JavaScript",
        "Web Development",
        "Software Development",
      ],
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name:
          "Sir Chhotu Ram Institute of Engineering & Technology (SCRIET), Chaudhary Charan Singh University, Meerut",
      },
    },
  ],
};

const About = () => (
  <section>
    <Seo
      title="About BuildWithVishant | Developer Platform for Notes, Code Playground & AI Learning"
      description="BuildWithVishant is a developer platform by Vishant Kumar for learning programming, practicing in an online code playground, and building real projects with AI-assisted help — free programming notes and coding resources for students and developers."
      path="/about"
      jsonLd={aboutJsonLd}
    />

    <SectionHeader
      eyebrow="About BuildWithVishant"
      title="A developer platform for learning programming, practicing code, and building real projects"
    >
      BuildWithVishant is a developer learning platform created by Vishant
      Kumar — built around programming notes, an in-browser coding
      playground, and an AI learning assistant, so learning and practicing
      code can happen in the same place.
    </SectionHeader>

    <div className="grid two">
      {/* 1. What is BuildWithVishant */}
      <article className="panel">
        <h2>What is BuildWithVishant?</h2>
        <p>
          BuildWithVishant is a developer platform and programming learning
          website, not just a personal portfolio page. It brings together
          programming notes, hands-on coding practice, and AI-assisted
          learning so that studying a concept and actually writing code stay
          connected, instead of living in separate tabs and tools.
        </p>
        <p>
          The platform is built and maintained by Vishant Kumar as an
          ongoing, developer-focused project — combining technical learning
          resources with the coding playground and project work that put
          those concepts into practice.
        </p>
      </article>

      {/* 2. What Can You Do on BuildWithVishant */}
      <article className="panel">
        <h2>What Can You Do on BuildWithVishant?</h2>
        <ul className="about-feature-list">
          {platformFeatures.map((feature) => (
            <li key={feature.title}>
              <strong>{feature.title}.</strong> {feature.body}
            </li>
          ))}
        </ul>
      </article>

      {/* 3. Why BuildWithVishant Exists */}
      <article className="panel">
        <h2>Why BuildWithVishant Exists</h2>
        <p>
          Most programming tutorials stop at explaining a concept. Turning
          that explanation into a habit of writing, running, and debugging
          code usually means switching to a separate editor, setting up a
          local environment, or hunting down a second resource just to
          practice. BuildWithVishant exists to close that gap — pairing
          programming notes with a coding playground that runs code
          instantly, so learning programming stays practical rather than
          purely theoretical.
        </p>
      </article>

      {/* 4. Built for Students and Developers */}
      <article className="panel">
        <h2>Built for Students and Developers</h2>
        <p>
          BuildWithVishant is built for anyone working through programming,
          not one specific skill level:
        </p>
        <ul>
          <li>Students learning programming for the first time</li>
          <li>Beginners looking for structured, readable programming notes</li>
          <li>Developers who want a fast place to practice or test code</li>
          <li>
            Software developers and web developers exploring new languages
            in the playground
          </li>
          <li>
            Anyone who prefers learning by reading notes and then
            immediately practicing what they learned
          </li>
        </ul>
      </article>

      {/* 5. Learn, Practice and Build */}
      <article className="panel">
        <h2>Learn, Practice and Build</h2>
        <p>
          The platform is organized around a simple loop: read a{" "}
          <Link to="/notes">programming note</Link> to understand a concept,
          open the <Link to="/playground">playground</Link> to write and run
          code that applies it, and lean on the{" "}
          <Link to="/assistant">AI assistant</Link> when something isn't
          clicking. Over time, that practice turns into the kind of real
          <Link to="/projects"> coding projects</Link> that demonstrate actual
          software development skill — not just familiarity with the theory.
        </p>
      </article>

      {/* 6. Technology and Development */}
      <article className="panel">
        <h2>Technology and Development</h2>
        <p>
          BuildWithVishant is itself built with the modern web development
          stack it teaches: a <strong>React.js</strong> and{" "}
          <strong>Vite</strong> front end, a <strong>Node.js</strong> and{" "}
          <strong>Express.js</strong> backend, and <strong>MongoDB</strong>{" "}
          for data storage. The code playground runs on the Monaco editor —
          the same editor engine behind Visual Studio Code — for a familiar,
          capable coding environment directly in the browser.
        </p>
      </article>

      {/* 7. Vision */}
      <article className="panel">
        <h2>Vision for BuildWithVishant</h2>
        <p>
          The long-term goal for BuildWithVishant is to keep growing as a
          practical, developer-focused learning and coding platform —
          expanding the notes library, refining the playground, and
          improving the AI assistant, so it stays a useful place to learn
          programming, practice code, and ship real projects.
        </p>
      </article>

      {/* 8. About Vishant */}
      <article className="panel">
        <h2>About Vishant</h2>
        <p>
          BuildWithVishant was created and is developed by{" "}
          <strong>Vishant Kumar</strong>, a Full Stack MERN Developer and
          B.Tech Information Technology student at Sir Chhotu Ram Institute
          of Engineering &amp; Technology (SCRIET), Chaudhary Charan Singh
          University, Meerut. His work centers on React.js, Node.js,
          Express.js, MongoDB and JavaScript, alongside regular Data
          Structures &amp; Algorithms practice in Java.
        </p>
        <div className="chips">
          {interests.map((interest) => (
            <span key={interest}>{interest}</span>
          ))}
        </div>
        <p className="about-links">
          Learn more via the <Link to="/skills">skills</Link>,{" "}
          <Link to="/education">education</Link>, and{" "}
          <Link to="/contact">contact</Link> pages.
        </p>
      </article>
    </div>
  </section>
);

export default About;
