
import { Github, Linkedin, Mail, Phone} from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { profile } from "../data/portfolio.js";
import styles from "./Footer.module.css";

const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.info}>
      <strong>Vishant Kumar</strong>

      <div className={styles.contact}>
        <a href={`mailto:${profile.email}`}>
          <Mail size={16} />
          {profile.email}
        </a>

        <a href="tel:+919258137579">
          <Phone size={16} />
          +91 9258137579
        </a>
      </div>

      <span>© {new Date().getFullYear()} Vishant Kumar. All rights reserved.</span>
    </div>

    <div className={styles.socials}>
      <a
        href={profile.instagram}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
      >
        <FaInstagram size={19} />
      </a>
      <a
        href={profile.github}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <Github size={19} />
      </a>

      <a
        href={profile.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <Linkedin size={19} />
      </a>

      <a
        href={`mailto:${profile.email}`}
        aria-label="Email"
      >
        <Mail size={19} />
      </a>
    </div>
  </footer>
);

export default Footer;
