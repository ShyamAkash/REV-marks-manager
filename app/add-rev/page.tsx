import { redirect } from "next/navigation";

export default function AddRevRedirect() {
  redirect("/manage/revs");
}
