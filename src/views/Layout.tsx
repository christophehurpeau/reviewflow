import type { ReactElement, ReactNode } from "react";

interface LayoutProps {
  lang?: string;
  title?: string;
  children: ReactNode;
}

export default function Layout({
  lang = "en",
  title = process.env.REVIEWFLOW_NAME,
  children,
}: LayoutProps): ReactElement {
  return (
    <html lang={lang}>
      <head>
        {/* eslint-disable-next-line unicorn/text-encoding-identifier-case */}
        <meta charSet="UTF-8" />
        <meta name="robots" content="noindex" />
        <title>{title}</title>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://christophe.hurpeau.com/index.css"
        />
        <style>{`html,body,html body
            #container{height:100%} footer{position:absolute;bottom:5px;left:0;right:0;}`}</style>
      </head>
      <body>
        <div style={{ padding: "24px 48px" }}>
          <div>
            <h1>{process.env.REVIEWFLOW_NAME}</h1>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
