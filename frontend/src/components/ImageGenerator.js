import { useState } from "react";
import { Image, Loader2, Download, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

export default function ImageGenerator({ onToast }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState([]); // { prompt, image_data, image_url, timestamp }
  const [error, setError] = useState(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        onToast(data.error, "error");
      } else {
        const newImage = {
          prompt: prompt.trim(),
          image_data: data.image_data,
          image_url: data.image_url,
          timestamp: new Date().toISOString(),
        };
        setImages((prev) => [newImage, ...prev]);
        setPrompt("");
        onToast("Image generated!", "success");
      }
    } catch {
      setError("Failed to generate image. Check backend.");
      onToast("Image generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (img) => {
    const link = document.createElement("a");
    if (img.image_data) {
      link.href = `data:image/png;base64,${img.image_data}`;
    } else if (img.image_url) {
      link.href = `${API_BASE}${img.image_url}`;
    }
    link.download = `nexusai_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold gradient-text">Image Studio</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate images from text descriptions
          </p>
        </div>

        {/* Prompt */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Prompt</h3>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A futuristic city skyline at sunset with flying cars..."
            rows={3}
            className="w-full bg-surface-muted border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center justify-between mt-3">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            <div className="ml-auto">
              <Button
                onClick={generate}
                disabled={generating || !prompt.trim()}
                className="bg-gradient-to-r from-primary to-accent border-0"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Gallery */}
        {images.length === 0 && !generating && (
          <div className="glass rounded-xl p-12 text-center">
            <Image className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No images generated yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Enter a prompt above to create your first image
            </p>
          </div>
        )}

        {generating && (
          <div className="glass-strong rounded-xl p-12 text-center animate-pulseGlow">
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-sm font-medium text-primary">Creating your image...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((img, i) => (
            <div key={i} className="glass-strong rounded-xl overflow-hidden group animate-fadeIn">
              <div className="aspect-square bg-surface-muted relative">
                <img
                  src={img.image_data ? `data:image/png;base64,${img.image_data}` : `${API_BASE}${img.image_url}`}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-background/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    onClick={() => downloadImage(img)}
                    variant="ghost"
                    className="text-foreground hover:bg-surface-hover"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{img.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
