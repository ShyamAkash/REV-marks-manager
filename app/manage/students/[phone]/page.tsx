import StudentDetailClient from "./StudentDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone || "");
  return {
    title: `Student Details (${decoded}) - RevMarks`,
    description: `Academic performance history, REV examination breakdown, and section marks for ${decoded}.`,
  };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  return <StudentDetailClient phone={decodeURIComponent(phone || "")} />;
}
