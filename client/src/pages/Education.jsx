
import {
  GraduationCap,
  BookOpen,
  Code2,
  Award
} from "lucide-react";

import SectionHeader from "../components/SectionHeader.jsx";
import { education } from "../data/portfolio.js";

const Education = () => (
  <section>
    <SectionHeader
      eyebrow="Education"
      title="Academic Journey"
    >
      Building a strong foundation in software engineering through academics,
      practical development, and continuous learning.
    </SectionHeader>

    <article className="timeline-card">
      <div className="icon">
        <GraduationCap size={28} />
      </div>

      <div className="education-content">
        <h3>{education.degree}</h3>

        <p>{education.institute}</p>

        <span>{education.duration}</span>

        <p>{education.focus}</p>

        <div className="education-grid">

          <div className="education-box">
            <h4>
              <BookOpen size={18} />
              Relevant Coursework
            </h4>

            <div className="chips">
              {education.coursework.map((course) => (
                <span key={course}>{course}</span>
              ))}
            </div>
          </div>

          <div className="education-box">
            <h4>
              <Code2 size={18} />
              Technologies
            </h4>

            <div className="chips">
              {education.technologies.map((tech) => (
                <span key={tech}>{tech}</span>
              ))}
            </div>
          </div>

          <div className="education-box">
            <h4>
              <Award size={18} />
              Highlights
            </h4>

            <ul>
              {education.achievements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </article>
  </section>
);

export default Education;
