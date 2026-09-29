import { motion } from 'framer-motion';
import SectionHeader from '../components/SectionHeader.jsx';
import { skills } from '../data/portfolio.js';

const Skills = () => (
  <section>
    <SectionHeader eyebrow="Skills" title="A practical MERN toolkit">
      Categorized skills with clean cards and subtle progress animations.
    </SectionHeader>
    <div className="skill-grid">
      {Object.entries(skills).map(([category, items], index) => (
        <motion.article
          className="panel skill-card"
          key={category}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
        >
          <h3>{category}</h3>
          {items.map((item, skillIndex) => (
            <div className="skill-row" key={item}>
              <span>{item}</span>
              <div className="progress">
                <motion.i initial={{ width: 0 }} animate={{ width: `${88 - skillIndex * 4}%` }} transition={{ duration: 0.9, delay: 0.12 }} />
              </div>
            </div>
          ))}
        </motion.article>
      ))}
    </div>
  </section>
);

export default Skills;
