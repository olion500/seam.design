import { Globe, ImagePlus, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/store/store";
import { uploadScreenshot } from "@/store/actions";

export function EmptyState() {
  return (
    <div className="canvas-dots flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl bg-white p-8 text-center shadow-pop">
        <h2 className="text-xl font-bold">첫 화면을 추가하세요</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">화면을 놓고, 화면 속 요소를 다른 화면으로 끌어 흐름을 만듭니다.</p>
        <Button size="lg" onClick={() => useEditor.getState().addScreen({ position: { x: 0, y: 0 } })}>
          <SquarePlus /> 화면 추가
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void uploadScreenshot({ x: 0, y: 0 })}>
            <ImagePlus /> 기준 스크린샷 올리기
          </Button>
          <Button variant="secondary" disabled title="서버 캡처 단계에서 지원합니다">
            <Globe /> URL에서 캡처
          </Button>
        </div>
        <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => useEditor.getState().loadExample()}>
          예시 프로젝트 불러오기
        </button>
      </div>
    </div>
  );
}
