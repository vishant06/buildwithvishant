import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  BookOpen,
  FolderKanban,
  GraduationCap,
  Hammer,
  Layers,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AboutFaqSection, { aboutFaqItems } from "../components/AboutFaqSection.jsx";
import ContactSection from "../components/ContactSection.jsx";
import Seo from "../components/Seo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import useTypingEffect from "../hooks/useTypingEffect.js";
import request, { absoluteAsset } from "../services/api.js";
import "../styles/home.css";

// Real, currently-supported Playground languages (mirrors src/pages/Playground.jsx).
// Kept as a lightweight local list rather than importing that page directly, so the
// homepage bundle doesn't have to pull in the Monaco editor just to read labels.
const PLAYGROUND_LANGUAGES = [
  "HTML / CSS / JS", "JavaScript", "TypeScript", "Python", "Java", "C", "C++",
  "C#", "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift", "Dart", "R", "Scala",
  "Bash / Shell", "SQL", "Lua", "Perl", "Haskell",
];

const STEPS = [
  {
    n: "01",
    icon: GraduationCap,
    title: "Learn",
    desc: "Explore structured programming notes across languages, frameworks and core CS concepts.",
  },
  {
    n: "02",
    icon: Wrench,
    title: "Practice",
    desc: "Write and run real code straight in the browser — no local setup required.",
  },
  {
    n: "03",
    icon: Hammer,
    title: "Build",
    desc: "Lean on the AI assistant and your notes to turn practice into real projects.",
  },
];

const fadeUp = (reduce, delay = 0) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.5, delay },
      };

const NoteCardSkeleton = () => (
  <div className="note-card skeleton-card" aria-hidden="true">
    <div className="skeleton-block skeleton-thumb" />
    <div>
      <div className="skeleton-block skeleton-line" style={{ width: "40%" }} />
      <div className="skeleton-block skeleton-line" style={{ width: "80%", height: 22, marginTop: 14 }} />
      <div className="skeleton-block skeleton-line" style={{ width: "95%" }} />
      <div className="skeleton-block skeleton-line" style={{ width: "60%" }} />
    </div>
  </div>
);

const SITE_URL = "https://www.buildwithvishant.in";

// Migrated from the old /about page's JSON-LD (WebSite / Organization /
// Person), plus a new FAQPage entry built from the About accordion content
// now that it lives on this page instead of a separate route. Keeping this
// as the only place that content is marked up avoids duplicate SEO content
// across two pages.
const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
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
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#about-faq`,
      mainEntity: aboutFaqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.plainText },
      })),
    },
  ],
};

const Home = () => {
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const reduceMotion = useReducedMotion();

  const typed = useTypingEffect([
    "programming notes",
    "a code playground",
    "an AI learning companion",
  ]);

  const [notes, setNotes] = useState([]);
  const [notesState, setNotesState] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let active = true;
    request("/notes")
      .then((data) => {
        if (!active) return;
        setNotes(Array.isArray(data) ? data : []);
        setNotesState("ready");
      })
      .catch(() => {
        if (active) setNotesState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const latestNotes = useMemo(() => notes.slice(0, 6), [notes]);
  const categories = useMemo(
    () => [...new Set(notes.map((note) => note.category).filter(Boolean))],
    [notes]
  );

  const stats = [
    { icon: BookOpen, label: "Notes published", value: notesState === "ready" ? notes.length : "—" },
    { icon: Layers, label: "Subjects covered", value: notesState === "ready" ? categories.length : "—" },
    { icon: Terminal, label: "Languages in Playground", value: PLAYGROUND_LANGUAGES.length },
    { icon: Sparkles, label: "AI learning assistant", value: "Built-in" },
  ];

  const firstName = user?.name?.split(" ")[0];

  return (
    <>
      <Seo
        title="BuildWithVishant | Notes, Code Playground & AI for Developers | By Vishant Kumar"
        description="BuildWithVishant is a developer learning platform by Vishant Kumar — programming notes, an in-browser code playground, and an AI learning assistant, alongside MERN Stack projects and portfolio work."
        path="/"
        jsonLd={homeJsonLd}
      />

      {/* ---------------------------------------------------------------- */}
      {/* HERO                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero">
        <motion.div {...fadeUp(reduceMotion)}>
          <span className="eyebrow">
            {isAuthenticated ? `Welcome back, ${firstName || "builder"} 👋` : "BuildWithVishant · developer learning platform"}
          </span>

          <h1>Learn. Code. Build.</h1>
          <h2>
            One platform for <span className="typing">{typed}</span>
          </h2>

          <p>
            Study clear programming notes, practice in a real in-browser code
            playground, and get unstuck faster with an AI learning companion —
            everything you need to go from concept to project, in one place.
          </p>

          <div className="actions">
            <Link className="btn primary" to="/notes">
              <BookOpen size={18} /> Explore Notes
            </Link>
            <Link className="btn secondary" to="/playground">
              <FolderKanban size={18} /> Open Playground
            </Link>
            <Link className="btn ghost" to="/assistant">
              <Bot size={18} /> Ask AI
            </Link>
          </div>
        </motion.div>

        <motion.div className="hero-visual" {...fadeUp(reduceMotion, 0.1)}>
          <div className="code-window hero-code-window">
            <div className="code-window-bar">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
              <span className="code-window-title">learn.js</span>
            </div>
            <pre className="code-window-body">
              <code>
                <span className="cw-kw">const</span> <span className="cw-var">platform</span> = {"{"}
                {"\n"}  notes<span className="cw-punc">:</span> <span className="cw-bool">true</span>,
                {"\n"}  playground<span className="cw-punc">:</span> <span className="cw-bool">true</span>,
                {"\n"}  ai<span className="cw-punc">:</span> <span className="cw-bool">true</span>
                {"\n"}
                {"}"};{"\n\n"}
                <span className="cw-fn">build</span>(platform);
              </code>
            </pre>
          </div>

          <div className="floating-badges" aria-hidden="true">
            <span className="floating-badge fb-1"><BookOpen size={14} /> Notes</span>
            <span className="floating-badge fb-2"><FolderKanban size={14} /> Playground</span>
            <span className="floating-badge fb-3"><Bot size={14} /> AI</span>
          </div>

          <div className="hero-profile-chip">
            <img
              src={theme === "dark" ? "/img-dark.png" : "/img-light.png"}
              alt="Vishant Kumar"
            />
            <div>
              <strong>Available for MERN projects</strong>
              <span>React • Express • MongoDB</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* HIGHLIGHTS                                                        */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-stats" {...fadeUp(reduceMotion)}>
        {stats.map(({ icon: Icon, label, value }) => (
          <div className="home-stat-card panel" key={label}>
            <Icon size={20} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* NOTES                                                             */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-section" {...fadeUp(reduceMotion)}>
        <div className="home-section-head">
          <div>
            <span className="eyebrow">From the learning library</span>
            <h2 className="home-section-title">Latest notes</h2>
            <p>Freshly published, straight from the Notes library.</p>
          </div>
          <Link className="btn ghost" to="/notes">
            View All Notes <ArrowRight size={16} />
          </Link>
        </div>

        {categories.length > 0 && (
          <div className="chips home-category-chips">
            {categories.slice(0, 8).map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
        )}

        {notesState === "loading" && (
          <div className="note-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <NoteCardSkeleton key={index} />
            ))}
          </div>
        )}

        {notesState === "error" && (
          <p className="notice error">
            Notes are temporarily unavailable. Please try again shortly.
          </p>
        )}

        {notesState === "ready" && latestNotes.length === 0 && (
          <div className="panel empty-state">
            <BookOpen size={26} />
            <p>No notes have been published yet — check back soon.</p>
          </div>
        )}

        {notesState === "ready" && latestNotes.length > 0 && (
          <div className="note-grid">
            {latestNotes.map((note) => (
              <article className="note-card" key={note._id}>
                {note.thumbnail && <img src={absoluteAsset(note.thumbnail)} alt="" />}
                <div>
                  <div className="chips">
                    <span>{note.category}</span>
                    <span>{note.difficulty}</span>
                  </div>
                  <h3>{note.title}</h3>
                  <p>{note.description}</p>
                  <div className="note-card-meta">
                    {note.author?.name && <span>{note.author.name}</span>}
                    {note.createdAt && (
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Link className="btn primary" to={`/notes/${note.slug}`}>
                    Read note
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* PLAYGROUND                                                        */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-section home-split" {...fadeUp(reduceMotion)}>
        <div>
          <span className="eyebrow">In-browser code playground</span>
          <h2 className="home-section-title">Code. Run. Experiment.</h2>
          <p>
            Write and execute real code directly in your browser — no local
            environment to configure. Save your work to your account and pick
            up exactly where you left off.
          </p>
          <div className="chips playground-lang-chips">
            {PLAYGROUND_LANGUAGES.slice(0, 9).map((lang) => (
              <span key={lang}>{lang}</span>
            ))}
            <span className="more-chip">+{PLAYGROUND_LANGUAGES.length - 9} more</span>
          </div>
          <Link className="btn primary" to="/playground">
            Open Playground <ArrowRight size={16} />
          </Link>
        </div>

        <div className="code-window playground-code-window" aria-hidden="true">
          <div className="code-window-bar">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <span className="code-window-title">playground.py</span>
          </div>
          <pre className="code-window-body">
            <code>
              <span className="cw-kw">def</span> <span className="cw-fn">greet</span>(name)<span className="cw-punc">:</span>
              {"\n"}    <span className="cw-kw">return</span> <span className="cw-str">f"Hello, {"{name}"}!"</span>
              {"\n\n"}
              <span className="cw-comment"># Run instantly — no setup</span>
              {"\n"}
              <span className="cw-fn">print</span>(<span className="cw-fn">greet</span>(<span className="cw-str">"builder"</span>))
            </code>
          </pre>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* AI                                                                */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-section home-split reverse" {...fadeUp(reduceMotion)}>
        <div className="ai-visual panel">
          <Bot size={36} />
          <p className="ai-visual-quote">
            "Explain React state batching with a short example."
          </p>
          <span className="ai-visual-hint">Ask about React, JavaScript, Node.js, MongoDB, debugging, or paste code to examine.</span>
        </div>

        <div>
          <span className="eyebrow">AI learning companion</span>
          <h2 className="home-section-title">Your AI-powered learning companion</h2>
          <p>
            Stuck on a bug or a concept? Chat with the built-in AI assistant —
            ask questions, paste code for a walkthrough, and keep the
            conversation going while you work.
          </p>
          <ul className="ai-feature-list">
            <li><Sparkles size={16} /> Real-time answers on React, JS, Node.js and MongoDB</li>
            <li><Sparkles size={16} /> Paste code and get it explained, line by line</li>
            <li><Sparkles size={16} /> Free with your BuildWithVishant account</li>
          </ul>
          <Link className="btn primary" to="/assistant">
            Try AI <ArrowRight size={16} />
          </Link>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* HOW IT WORKS                                                      */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-section" {...fadeUp(reduceMotion)}>
        <div className="section-header">
          <span className="eyebrow">How it works</span>
          <h2 className="home-section-title">From learning to building, in three steps</h2>
        </div>
        <div className="steps-grid">
          {STEPS.map(({ n, icon: Icon, title, desc }) => (
            <div className="step-card panel" key={n}>
              <span className="step-number">{n}</span>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* FINAL CTA                                                         */}
      {/* ---------------------------------------------------------------- */}
      <motion.section className="home-final-cta panel" {...fadeUp(reduceMotion)}>
        <h2>
          {isAuthenticated
            ? `Keep the momentum going, ${firstName || "builder"}.`
            : "Everything you need to learn, practice and build."}
        </h2>
        <p>
          {isAuthenticated
            ? "Jump back into your notes, playground, or ask the AI assistant a question."
            : "Programming notes, a real code playground, and an AI companion — free to start."}
        </p>
        <div className="actions">
          <Link className="btn primary" to="/notes">
            <BookOpen size={18} /> Explore Notes
          </Link>
          <Link className="btn secondary" to="/playground">
            <FolderKanban size={18} /> Start Coding
          </Link>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* ABOUT / FAQ                                                       */}
      {/* ---------------------------------------------------------------- */}
      <AboutFaqSection />

      {/* ---------------------------------------------------------------- */}
      {/* CONTACT                                                           */}
      {/* ---------------------------------------------------------------- */}
      <ContactSection />
    </>
  );
};

export default Home;
