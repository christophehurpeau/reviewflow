import React from 'react';

interface LayoutProps {
  lang?: string;
  title?: string;
  children: React.ReactNode;
}

export default function Layout({
  lang = 'en',
  title = process.env.REVIEWFLOW_NAME,
  children,
}: LayoutProps) {
  return (
    <html lang={lang}>
      <head>
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
        <div style={{ padding: '24px 48px' }}>{children}</div>
      </body>
    </html>
  );
}
