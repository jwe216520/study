import './globals.css';
export const metadata = { title: '拾知 Study｜護理學習空間', description: '從理解開始，讓每一次複習都有方向。私人護理學習筆記、單字卡與測驗。', robots: { index: false, follow: false } };
export default function RootLayout({ children }) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
