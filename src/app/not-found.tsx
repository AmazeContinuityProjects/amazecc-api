import { EmptyState, Button } from "@amazecontinuityprojects/amazeui";
import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#03060F] p-4">
      <div className="max-w-md w-full">
        <EmptyState 
          icon={<FileQuestion className="w-12 h-12 text-gray-400" />}
          title="Page Not Found"
          description="The page or endpoint you are looking for does not exist or has been moved."
          action={
            <Link href="/docs">
              <Button variant="primary" className="mt-4 gap-2">
                <Home className="w-4 h-4" /> Go to API Docs
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
