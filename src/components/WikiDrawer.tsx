import { Popover, Tag } from "antd";
import { useEffect, useState } from "react";

const WIKI_TITLES: Record<string, string> = {
  "H-chondrite": "H_chondrite",
  "L-chondrite": "L_chondrite",
  "LL-chondrite": "LL_chondrite",
  Carbonaceous: "Carbonaceous_chondrite",
  Iron: "Iron_meteorite",
  Achondrite: "Achondrite",
  Enstatite: "Enstatite_chondrite",
  "Stony-iron": "Stony-iron_meteorite",
  Martian: "Martian_meteorite",
  Lunar: "Lunar_meteorite",
  Other: "Meteorite_classification",
};

function WikiContent({ classification }: { classification: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const title = WIKI_TITLES[classification];
    if (!title) {
      setError("No Wikipedia article for this classification.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);

    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(title)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((raw) => {
        if (cancelled) return;
        const withBase = raw.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="https://en.wikipedia.org/">`,
        );
        setHtml(withBase);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classification]);

  return (
    <div className="w-72 h-80">
      {loading && (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
        </div>
      )}
      {error && (
        <div className="p-3 text-xs text-red-600">Failed to load: {error}</div>
      )}
      {html && (
        <iframe
          srcDoc={html}
          title={`Wikipedia: ${classification}`}
          className="w-full h-full border-0 rounded"
          sandbox="allow-same-origin"
        />
      )}
    </div>
  );
}

interface WikiTagProps {
  classification: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function WikiTag({ classification, checked, onChange }: WikiTagProps) {
  return (
    <Popover
      content={<WikiContent classification={classification} />}
      title={classification}
      trigger="hover"
      mouseEnterDelay={0.4}
      placement="right"
    >
      <Tag.CheckableTag checked={checked} onChange={onChange}>
        {classification}
      </Tag.CheckableTag>
    </Popover>
  );
}
