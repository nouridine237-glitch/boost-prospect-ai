export async function downloadCertificate(name: string, sponsor: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;
  doc.setFillColor(11, 15, 26); doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(46, 124, 255); doc.setLineWidth(1.2); doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.3); doc.rect(14, 14, W - 28, H - 28);
  doc.setTextColor(46, 124, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("MLM BOOST AI - ACADÉMIE MLM", W / 2, 38, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(34);
  doc.text("Certificat de réussite", W / 2, 62, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(180, 190, 210);
  doc.text("Ce certificat est décerné à", W / 2, 82, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(255, 255, 255);
  doc.text(name, W / 2, 100, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(180, 190, 210);
  doc.text("pour avoir validé les 6 niveaux de la formation « Former mon équipe »", W / 2, 116, { align: "center" });
  doc.text("avec un score minimum de 80 % à chaque quiz.", W / 2, 124, { align: "center" });
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(11);
  doc.text(`Délivré le ${date}`, 60, 160, { align: "center" });
  if (sponsor) doc.text(`Parrain : ${sponsor}`, W - 60, 160, { align: "center" });
  doc.setDrawColor(46, 124, 255); doc.line(30, 152, 90, 152); if (sponsor) doc.line(W - 90, 152, W - 30, 152);
  doc.setFontSize(9); doc.setTextColor(120, 130, 150);
  doc.text("Aucun revenu garanti - outil d'aide à la prospection", W / 2, 186, { align: "center" });
  doc.save(`certificat-${name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
