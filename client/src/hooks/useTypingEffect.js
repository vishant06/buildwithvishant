import { useEffect, useState } from 'react';

const useTypingEffect = (words, speed = 90, pause = 1200) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIndex % words.length];
    const doneTyping = !deleting && text === word;
    const doneDeleting = deleting && text === '';

    const timer = setTimeout(
      () => {
        if (doneTyping) setDeleting(true);
        else if (doneDeleting) {
          setDeleting(false);
          setWordIndex((current) => current + 1);
        } else {
          const nextLength = deleting ? text.length - 1 : text.length + 1;
          setText(word.slice(0, nextLength));
        }
      },
      doneTyping ? pause : speed
    );

    return () => clearTimeout(timer);
  }, [deleting, pause, speed, text, wordIndex, words]);

  return text;
};

export default useTypingEffect;
