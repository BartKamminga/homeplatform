// Gedeelde afbeelding-upload-helper (item 887) - geextraheerd uit
// RoadmapItemForm.jsx (item 639), nu ook gebruikt door ReportBugWidget.jsx.
// Rechtstreekse fetch (niet via core/api.js's request()) omdat dit een
// FormData-body is, geen JSON.
export async function uploadImageFile(file, category = "roadmap") {
  const fd = new FormData();
  fd.append("file", file, file.name || "paste.png");
  const res = await fetch(`/api/uploads?category=${category}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("hp_token")}` },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload mislukt");
  return (await res.json()).url;
}
