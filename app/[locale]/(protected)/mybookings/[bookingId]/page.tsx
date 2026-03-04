import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    bookingId: string;
    locale: string;
  }>;
}

const BookingRedirectPage = async ({ params }: PageProps) => {
  const resolvedParams = await params;
  return redirect(
    `/profile?bookingRef=${encodeURIComponent(resolvedParams.bookingId)}`,
  );
};

export default BookingRedirectPage;
