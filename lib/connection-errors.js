// Fetch failures do not reveal whether DNS, the network, or browser blocking caused them.
export function isNetworkError(error) {
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error?.message || '');
}

export function connectionMessage(error, target = 'Supabase') {
  if (isNetworkError(error)) return `無法連線至${target}。請確認網路，或改用手機行動網路測試；也請檢查 VPN、瀏覽器擴充功能與服務狀態。`;
  return error?.message || '查詢失敗，請稍後再試。';
}

export function saveErrorMessage(error) {
  if (isNetworkError(error)) return `${connectionMessage(error)}尚未收到操作結果，無法確認是否已寫入；請先關閉視窗並重新整理，確認資料是否已更新，再決定是否重試。`;
  return error?.message || '保存失敗，請稍後再試。';
}
