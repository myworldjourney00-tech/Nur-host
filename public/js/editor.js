function initEditor(editorId, lineNumId, previewId) {
  const editor = document.getElementById(editorId);
  const lineNumbers = document.getElementById(lineNumId);
  const preview = document.getElementById(previewId);

  if (!editor || !lineNumbers) return;

  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
      numbers += i + '<br>';
    }
    lineNumbers.innerHTML = numbers;
  }

  // অটো-ইনডেন্টেশন এবং ট্যাব কি সাপোর্ট
  editor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
      updateLineNumbers();
    }
  });

  editor.addEventListener('input', () => {
    updateLineNumbers();
    updateLivePreview();
  });

  editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });

  function updateLivePreview() {
    if (!preview) return;
    preview.srcdoc = editor.value;
  }

  // ইনিশিয়াল আপডেট
  updateLineNumbers();
  updateLivePreview();

  return {
    updatePreview: updateLivePreview,
    clear: () => { editor.value = ''; updateLineNumbers(); updateLivePreview(); },
    setContent: (content) => { editor.value = content; updateLineNumbers(); updateLivePreview(); }
  };
}
