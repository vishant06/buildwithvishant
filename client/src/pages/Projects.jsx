import { ExternalLink, Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import Loader from '../components/Loader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import request, { absoluteAsset } from '../services/api.js';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/projects')
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <SectionHeader eyebrow="Projects" title="Projects I've worked on">
        Projects are fetched dynamically from the backend and managed through the admin dashboard.
      </SectionHeader>
      {loading && <Loader label="Loading projects" />}
      {error && <p className="notice error">{error}</p>}
      {!loading && !error && projects.length === 0 && <p className="notice">No projects added yet. Add one from the admin dashboard.</p>}
      <div className="project-grid">
        {projects.map((project) => (
          <article className="project-card" key={project._id}>
            {project.featured && <span className="badge">Featured</span>}
            <img src={absoluteAsset(project.image) || '/profile-placeholder.svg'} alt={project.title} />
            <div>
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="chips">
                {project.technologies.map((tech) => (
                  <span key={tech}>{tech}</span>
                ))}
              </div>
              <div className="card-actions">
                {project.githubLink && <a href={project.githubLink} target="_blank" rel="noreferrer"><Github size={17} /> GitHub</a>}
                {project.liveLink && <a href={project.liveLink} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Live Demo</a>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Projects;
