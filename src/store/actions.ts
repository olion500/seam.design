import { pickFile, readAsDataURL } from "@/lib/files";
import { useEditor } from "./store";

export async function uploadScreenshot(position?: { x: number; y: number }) {
  const file = await pickFile("image/*");
  if (!file) return;
  const image = await readAsDataURL(file);
  useEditor.getState().addScreen({ name: file.name.replace(/\.[^.]+$/, ""), image, position });
}

export async function uploadBaseline(screenId: string) {
  const file = await pickFile("image/*");
  if (!file) return;
  useEditor.getState().setBaselineImage(screenId, await readAsDataURL(file));
}
