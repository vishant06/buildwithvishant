import { useRouter } from "expo-router";
import Screen from "../../../components/Screen.jsx";
import NoteForm from "../../../components/NoteForm.jsx";
import { createNote } from "../../../services/notes.js";

export default function NewNote() {
  const router = useRouter();

  const submit = async (payload) => {
    await createNote(payload);
    router.back();
  };

  return (
    <Screen>
      <NoteForm onSubmit={submit} submitLabel="Create note" />
    </Screen>
  );
}
