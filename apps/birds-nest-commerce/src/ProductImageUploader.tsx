import { useState } from "react";
import { supabase } from "./lib/supabase";

export function ProductImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const upload = async (file?: File) => {
    if (!file || !supabase) return;
    setUploading(true);
    setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) setMessage(error.message);
    else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
      setMessage("Photo uploaded");
    }
    setUploading(false);
  };

  return <div className="image-uploader">
    {value && <img src={value} alt="Product preview" />}
    <label>Product photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event=>upload(event.target.files?.[0])}/></label>
    <span>{uploading ? "Uploading photo…" : message}</span>
    <details><summary>Use an existing image URL</summary><input type="url" value={value} onChange={event=>onChange(event.target.value)} placeholder="https://…"/></details>
  </div>;
}
