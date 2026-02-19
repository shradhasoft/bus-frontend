import { redirect } from "next/navigation";

const BookingsPage = () => {
  return redirect("/profile?tab=upcoming");
};

export default BookingsPage;
