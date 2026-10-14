import { enCatalog } from "./en"

// English remains the fallback for catalog entries not translated yet.
export const jaCatalog: Record<string, string> = {
  ...enCatalog,
  "Dashboard": "ダッシュボード", "Content": "コンテンツ", "Pages": "ページ", "Media library": "メディアライブラリ",
  "Appearance": "外観", "Themes": "テーマ", "Store": "ストア", "Catalog": "カタログ", "Sales": "売上",
  "Customers": "顧客", "Management": "管理", "Users": "ユーザー", "Extensions": "拡張機能", "System": "システム",
  "Settings": "設定", "Updates": "更新", "More tools": "その他のツール", "Account": "アカウント", "Profile": "プロフィール",
  "Help": "ヘルプ", "Log out": "ログアウト", "Signing out…": "ログアウト中…", "Refresh": "更新", "Refresh page data": "ページデータを更新",
  "Profile settings": "プロフィール設定", "Basic information": "基本情報", "Security": "セキュリティ", "Name": "名前", "Email": "メールアドレス",
  "Admin panel language": "管理画面の言語", "Choose the language used in the admin panel.": "管理画面で使用する言語を選択してください。",
  "This language applies only to the admin panel.": "この言語設定は管理画面にのみ適用されます。", "Panel theme": "パネルのテーマ",
  "System default": "システムの既定", "Panel font": "パネルのフォント", "Save changes": "変更を保存", "Profile saved.": "プロフィールを保存しました。",
  "Could not save profile.": "プロフィールを保存できませんでした。", "New password": "新しいパスワード", "Confirm new password": "新しいパスワードを確認",
  "Current password": "現在のパスワード", "Password": "パスワード", "Sign in": "ログイン", "Forgot password?": "パスワードをお忘れですか？",
  "Try again": "再試行", "Loading…": "読み込み中…", "Status": "ステータス", "Actions": "操作", "Search": "検索",
  "Activate": "有効化", "Deactivate": "無効化", "Draft": "下書き", "Close": "閉じる", "Inactive": "無効", "Active": "有効",
  "Remove": "削除", "Update": "更新", "View": "表示", "Create page": "ページを作成", "Select": "選択", "Administrator": "管理者",
  "Title": "タイトル", "Saving…": "保存中…", "User": "ユーザー", "Published": "公開済み", "Role": "権限", "Install": "インストール",
  "Installed": "インストール済み", "Version": "バージョン", "Error": "エラー", "File": "ファイル", "Theme": "テーマ", "Show": "表示",
  "Search pages, sections and settings…": "ページ、セクション、設定を検索…", "No records found.": "レコードが見つかりません。",
  "No matches": "一致する項目はありません", "Unsaved changes": "未保存の変更", "Close all": "すべて閉じる", "Admin panel": "管理画面",
  "System overview": "システム概要", "Quick actions": "クイック操作", "New page": "新しいページ", "Check for updates": "更新を確認",
  "Open updates →": "更新を開く →", "Platform version": "プラットフォームのバージョン", "Manage pages →": "ページを管理 →",
  "Manage extensions →": "拡張機能を管理 →", "Manage users →": "ユーザーを管理 →",
}
