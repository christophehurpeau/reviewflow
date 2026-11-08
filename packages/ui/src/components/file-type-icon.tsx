import type { SVGIconElement } from "alouette";
import { Icon } from "alouette";
import { BracketsCurlyRegularIcon } from "alouette-icons/phosphor-icons/BracketsCurly";
import { FileRegularIcon } from "alouette-icons/phosphor-icons/File";
import { FileCssRegularIcon } from "alouette-icons/phosphor-icons/FileCss";
import { FileHtmlRegularIcon } from "alouette-icons/phosphor-icons/FileHtml";
import { FileImageRegularIcon } from "alouette-icons/phosphor-icons/FileImage";
import { FileJsRegularIcon } from "alouette-icons/phosphor-icons/FileJs";
import { FileJsxRegularIcon } from "alouette-icons/phosphor-icons/FileJsx";
import { FileLockRegularIcon } from "alouette-icons/phosphor-icons/FileLock";
import { FileMdRegularIcon } from "alouette-icons/phosphor-icons/FileMd";
import { FilePyRegularIcon } from "alouette-icons/phosphor-icons/FilePy";
import { FileRsRegularIcon } from "alouette-icons/phosphor-icons/FileRs";
import { FileSqlRegularIcon } from "alouette-icons/phosphor-icons/FileSql";
import { FileSvgRegularIcon } from "alouette-icons/phosphor-icons/FileSvg";
import { FileTsRegularIcon } from "alouette-icons/phosphor-icons/FileTs";
import { FileTsxRegularIcon } from "alouette-icons/phosphor-icons/FileTsx";
import { FileTxtRegularIcon } from "alouette-icons/phosphor-icons/FileTxt";
import { FileVueRegularIcon } from "alouette-icons/phosphor-icons/FileVue";
import { GearSixRegularIcon } from "alouette-icons/phosphor-icons/GearSix";
import { PackageRegularIcon } from "alouette-icons/phosphor-icons/Package";
import { TerminalRegularIcon } from "alouette-icons/phosphor-icons/Terminal";
import { TestTubeRegularIcon } from "alouette-icons/phosphor-icons/TestTube";
import type { ReactNode } from "react";
import type { FileKind } from "./file-kind.ts";
import { fileKindOf } from "./file-kind.ts";

const glyphOf = (kind: FileKind): SVGIconElement => {
  if (kind === "typescript") return <FileTsRegularIcon />;
  if (kind === "tsx") return <FileTsxRegularIcon />;
  if (kind === "javascript") return <FileJsRegularIcon />;
  if (kind === "jsx") return <FileJsxRegularIcon />;
  if (kind === "json") return <BracketsCurlyRegularIcon />;
  if (kind === "package") return <PackageRegularIcon />;
  if (kind === "lock") return <FileLockRegularIcon />;
  if (kind === "markdown") return <FileMdRegularIcon />;
  if (kind === "css") return <FileCssRegularIcon />;
  if (kind === "html") return <FileHtmlRegularIcon />;
  if (kind === "image") return <FileImageRegularIcon />;
  if (kind === "svg") return <FileSvgRegularIcon />;
  if (kind === "config") return <GearSixRegularIcon />;
  if (kind === "shell") return <TerminalRegularIcon />;
  if (kind === "sql") return <FileSqlRegularIcon />;
  if (kind === "python") return <FilePyRegularIcon />;
  if (kind === "rust") return <FileRsRegularIcon />;
  if (kind === "vue") return <FileVueRegularIcon />;
  if (kind === "text") return <FileTxtRegularIcon />;
  return <FileRegularIcon />;
};

interface FileTypeIconProps {
  path: string;
  /** a test or a story, whatever its extension */
  test: boolean;
  size: number;
}

export function FileTypeIcon({
  path,
  test,
  size,
}: FileTypeIconProps): ReactNode {
  return (
    <Icon
      icon={test ? <TestTubeRegularIcon /> : glyphOf(fileKindOf(path))}
      size={size}
      className="text-muted"
    />
  );
}
