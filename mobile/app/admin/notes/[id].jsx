import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState } from "../../../components/RequestStates.jsx";
import Screen from "../../../components/Screen.jsx";
import NoteForm from "../../../components/NoteForm.jsx";
import { getAdminNote, updateNote } from "../../../services/notes.js";

export default function EditNote() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setNote(await getAdminNote(id));
      setStatus("idle");
    } catch (_error) {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async (payload) => {
    await updateNote(id, payload);
    router.back();
  };

  if (status === "loading") return <Screen><LoadingState /></Screen>;
  if (status === "error" || !note) return <Screen><ErrorState onRetry={load} /></Screen>;

  return (
    <Screen>
      <NoteForm initial={note} onSubmit={submit} submitLabel="Save changes" />
    </Screen>
  );
}
