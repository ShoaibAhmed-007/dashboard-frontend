import { Toaster } from "@/components/ui/toast/Toaster";
import { SidebarProvider } from "@/context/SidebarContext";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { NumberInputGuards } from "@/app/providers/NumberInputGuards";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (!theme) {
      theme = 'light';
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-white dark:bg-gray-900" suppressHydrationWarning>
        {/* Stops trackpad scrolling from silently editing number fields. */}
        <NumberInputGuards />
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <SidebarProvider>
                  <TaskProvider>{children}</TaskProvider>
                </SidebarProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
