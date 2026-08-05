export function questActionLabel(count, duel = false) {
  return duel ? `接受${count}回合對戰` : `接受${count}題委託`;
}

export function questCompleteLabel(count, figure, duel = false) {
  return `完成${count}${duel ? '回合' : '題'}，繼續${figure}篇（Enter）`;
}
