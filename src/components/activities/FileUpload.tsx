import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Download, Image, FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  files: string[];
  onFilesChange: (files: string[]) => void;
  folder?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function getPublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/attachments/${path}`;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

function getFileName(url: string) {
  const parts = url.split("/");
  const name = parts[parts.length - 1];
  // Remove uuid prefix if present
  return name.replace(/^[a-f0-9-]{36}_/, "");
}

export function FileUpload({ files, onFilesChange, folder = "general" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${crypto.randomUUID()}_${file.name}`;

      const { error } = await supabase.storage.from("attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error(`Feil ved opplasting av ${file.name}: ${error.message}`);
        continue;
      }

      newUrls.push(path);
    }

    if (newUrls.length > 0) {
      onFilesChange([...files, ...newUrls]);
      toast.success(`${newUrls.length} fil(er) lastet opp`);
    }
    setUploading(false);
  }, [files, onFilesChange, folder]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const removeFile = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Laster opp...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Dra og slipp filer her, eller klikk for å velge
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Bilder, PDF, dokumenter
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, i) => {
            const publicUrl = file.startsWith("http") ? file : getPublicUrl(file);
            const isImage = isImageUrl(file) || isImageUrl(publicUrl);
            const name = getFileName(file);

            return (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                {isImage ? (
                  <img
                    src={publicUrl}
                    alt={name}
                    className="h-8 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs flex-1 truncate">{name}</span>
                <a
                  href={publicUrl}
                  download={name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Download className="h-3 w-3" />
                  </Button>
                </a>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
