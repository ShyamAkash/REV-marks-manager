import StudentsClient from "./StudentsClient";

export const metadata = {
  title: "Student Directory - RevMarks",
  description: "Browse students by assigned town, view REV exam history, and analyze individual performance scores.",
};

export default function StudentsPage() {
  return <StudentsClient />;
}
