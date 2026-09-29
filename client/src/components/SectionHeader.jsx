import { motion } from 'framer-motion';

const SectionHeader = ({ eyebrow, title, children }) => (
  <motion.div
    className="section-header"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
  >
    <span>{eyebrow}</span>
    <h1>{title}</h1>
    {children && <p>{children}</p>}
  </motion.div>
);

export default SectionHeader;
