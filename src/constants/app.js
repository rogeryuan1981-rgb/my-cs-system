export const APP_VERSION = "v3.8 (全面現代化提示版)";

export const GLOBAL_FONT_SIZE_STYLES = `
  /* 「一般」即為放大後的新基準；「放大」再額外提高約 12%。 */
  html { font-size: 17px !important; }
  html.cs-font-large { font-size: 19px !important; }
  @media (min-width: 1440px) {
    html { font-size: 18px !important; }
    html.cs-font-large { font-size: 20px !important; }
  }
  @media (min-width: 1920px) {
    html { font-size: 20px !important; }
    html.cs-font-large { font-size: 22px !important; }
  }
  @media (min-width: 2560px) {
    html { font-size: 22px !important; }
    html.cs-font-large { font-size: 24px !important; }
  }
`;

export const ROLES = {
  ADMIN: "後台管理者",
  USER: "一般使用者",
  VIEWER: "紀錄檢視者",
};
