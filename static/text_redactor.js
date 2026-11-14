(function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const sidebar = document.getElementById('sidebar');
    const mainArea = document.getElementById('mainArea');
    const editor = document.getElementById('editor');
    const editorContainer = document.getElementById('editorContainer');
    const floatingToolbar = document.getElementById('floatingToolbar');
    const fileInput = document.getElementById('fileInput');
    const vd5Input = document.getElementById('vd5Input');
    const contextMenu = document.getElementById('contextMenu');
    const dragPreview = document.getElementById('dragPreview');
    const filePreviewTooltip = document.getElementById('filePreviewTooltip');
    const saveIndicator = document.getElementById('saveIndicator');
    const linkDialogOverlay = document.getElementById('linkDialogOverlay');
    const linkTitleInput = document.getElementById('linkTitleInput');
    const linkUrlInput = document.getElementById('linkUrlInput');
    const linkDialogCancel = document.getElementById('linkDialogCancel');
    const linkDialogApply = document.getElementById('linkDialogApply');
    const topControls = document.getElementById('topControls');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const STORAGE_KEY = 'vd5_document';
    const VD5_FORMAT = 'vd5';
    const VD5_VERSION = 1;
    let isOpen = false;
    let savedRange = null;
    let contextMenuRange = null;
    let pendingInsertAction = null;
    let selectedImage = null;
    let selectedVideo = null;
    let selectedFile = null;
    let selectedTable = null;
    let selectedLink = null;
    let resizeHandle = null;
    let alignHandle = null;
    let deleteHandle = null;
    let tableAddColBtn = null;
    let tableAddRowBtn = null;
    let tableDeleteBtn = null;
    let isResizing = false;
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0;
    let startRatio = 1;
    let isDragOver = false;
    let dragCounter = 0;
    let linkInsertRange = null;
    let linkInsertMode = null;
    let dropTargetRange = null;
    let dropPlaceholder = null;
    let previewTooltipTimer = null;
    let previewTooltipTarget = null;
    let previewTooltipRequestId = 0;
    let saveTimer = null;
    let isInternalChange = false;
    let isEditingEnabled = false;
    let apiOptions = {};
    let documentId = null;

    const ICON_VOLUME = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
    const ICON_MUTED = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
    const SVG_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    const SVG_RESIZE = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/><polyline points="21 3 21 9 15 3"/><polyline points="3 21 3 15 9 21"/></svg>';
    const SVG_ALIGN = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/></svg>';
    const SVG_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';

    let historyStack = [];
    let historyIndex = -1;
    let isRestoringHistory = false;
    let historyDebounceTimer = null;

    function updateHistoryButtons() {
        if (!undoBtn || !redoBtn) return;
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= historyStack.length - 1;
    }

    function pushHistoryState() {
        if (isRestoringHistory) return;
        const html = editor.innerHTML;
        if (historyIndex >= 0 && historyStack[historyIndex] === html) {
            updateHistoryButtons();
            return;
        }
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(html);
        if (historyStack.length > 200) {
            historyStack.shift();
        }
        historyIndex = historyStack.length - 1;
        updateHistoryButtons();
    }

    function scheduleHistoryPush() {
        if (isRestoringHistory) return;
        if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
        historyDebounceTimer = setTimeout(() => {
            historyDebounceTimer = null;
            pushHistoryState();
        }, 300);
    }

    function restoreHistoryState(index) {
        if (index < 0 || index >= historyStack.length) return;
        isRestoringHistory = true;
        isInternalChange = true;
        editor.innerHTML = historyStack[index];
        isInternalChange = false;
        isRestoringHistory = false;
        historyIndex = index;
        initializeAllVideos();
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
        updateHistoryButtons();
        scheduleSave();
    }

    function undo() {
        if (historyIndex > 0) {
            restoreHistoryState(historyIndex - 1);
        }
    }

    function redo() {
        if (historyIndex < historyStack.length - 1) {
            restoreHistoryState(historyIndex + 1);
        }
    }

    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    function clampX(x, size) {
        return Math.min(Math.max(x, 6), window.innerWidth - size - 6);
    }
    function clampY(y, size) {
        return Math.min(Math.max(y, 6), window.innerHeight - size - 6);
    }

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function createDeleteHandle() {
        if (deleteHandle) return deleteHandle;
        const handle = document.createElement('div');
        handle.className = 'delete-handle';
        handle.title = 'Удалить';
        handle.innerHTML = SVG_TRASH;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = selectedImage || selectedVideo || selectedLink || selectedTable;
            if (!target) return;
            target.remove();
            deselectImage();
            deselectVideo();
            deselectLink();
            deselectTable();
            scheduleSave();
        });
        document.body.appendChild(handle);
        deleteHandle = handle;
        return handle;
    }

    function createResizeHandle() {
        if (resizeHandle) return resizeHandle;
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.title = 'Потяните для изменения размера';
        handle.innerHTML = SVG_RESIZE;
        handle.addEventListener('mousedown', onResizeStart);
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
        document.body.appendChild(handle);
        resizeHandle = handle;
        return handle;
    }

    function createAlignHandle() {
        if (alignHandle) return alignHandle;
        const handle = document.createElement('div');
        handle.className = 'align-handle';
        handle.title = 'Изменить выравнивание';
        handle.innerHTML = SVG_ALIGN;
        handle.addEventListener('click', onAlignClick);
        document.body.appendChild(handle);
        alignHandle = handle;
        return handle;
    }

    function showHandles(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const handleSize = 28;
        const resize = createResizeHandle();
        const align = createAlignHandle();
        const del = createDeleteHandle();
        const baseRight = rect.right;
        const baseBottom = rect.bottom;
        align.style.left = clampX(baseRight - handleSize * 3 - 16, handleSize) + 'px';
        align.style.top = clampY(baseBottom - handleSize + 6, handleSize) + 'px';
        align.style.display = 'flex';
        del.style.left = clampX(baseRight - handleSize * 2 - 12, handleSize) + 'px';
        del.style.top = clampY(baseBottom - handleSize + 6, handleSize) + 'px';
        del.style.display = 'flex';
        resize.style.left = clampX(baseRight - handleSize + 6, handleSize) + 'px';
        resize.style.top = clampY(baseBottom - handleSize + 6, handleSize) + 'px';
        resize.style.display = 'flex';
    }

    function showDeleteOnly(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const handleSize = 28;
        const del = createDeleteHandle();
        const baseRight = rect.right;
        const baseBottom = rect.bottom;
        del.style.left = clampX(baseRight - handleSize + 6, handleSize) + 'px';
        del.style.top = clampY(baseBottom - handleSize + 6, handleSize) + 'px';
        del.style.display = 'flex';
    }

    function hideHandles() {
        if (resizeHandle) resizeHandle.style.display = 'none';
        if (alignHandle) alignHandle.style.display = 'none';
        if (deleteHandle) deleteHandle.style.display = 'none';
    }

    function deselectImage() {
        if (selectedImage) {
            selectedImage.classList.remove('selected');
            selectedImage = null;
        }
        hideHandles();
    }

    function deselectVideo() {
        if (selectedVideo) {
            selectedVideo.classList.remove('selected');
            const videoEl = selectedVideo.querySelector('video');
            if (videoEl && !videoEl.paused) {
                videoEl.pause();
            }
            selectedVideo = null;
        }
        hideHandles();
    }

    function deselectFile() {
        if (selectedFile) {
            selectedFile.classList.remove('selected');
            selectedFile = null;
        }
    }

    function deselectLink() {
        if (selectedLink) {
            selectedLink.classList.remove('selected');
            selectedLink = null;
        }
        hideHandles();
    }

    function selectImage(img) {
        if (selectedImage === img) {
            showHandles(img);
            return;
        }
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
        selectedImage = img;
        img.classList.add('selected');
        showHandles(img);
    }

    function selectVideo(videoWrapper) {
        if (selectedVideo === videoWrapper) {
            showHandles(videoWrapper);
            return;
        }
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
        selectedVideo = videoWrapper;
        videoWrapper.classList.add('selected');
        showHandles(videoWrapper);
    }

    function selectFile(fileEl) {
        if (selectedFile === fileEl) return;
        deselectFile();
        deselectImage();
        deselectVideo();
        deselectTable();
        deselectLink();
        selectedFile = fileEl;
        fileEl.classList.add('selected');
    }

    function selectLink(linkEl) {
        if (selectedLink === linkEl) {
            showDeleteOnly(linkEl);
            return;
        }
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
        selectedLink = linkEl;
        linkEl.classList.add('selected');
        showDeleteOnly(linkEl);
    }

    function createTableAddButtons() {
        if (tableAddColBtn && tableAddRowBtn && tableDeleteBtn) return;
        tableAddColBtn = document.createElement('button');
        tableAddColBtn.className = 'table-add-col';
        tableAddColBtn.title = 'Добавить столбец';
        tableAddColBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addColumnToTable(selectedTable);
        });
        tableAddRowBtn = document.createElement('button');
        tableAddRowBtn.className = 'table-add-row';
        tableAddRowBtn.title = 'Добавить строку';
        tableAddRowBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addRowToTable(selectedTable);
        });
        tableDeleteBtn = document.createElement('button');
        tableDeleteBtn.className = 'table-delete-handle';
        tableDeleteBtn.title = 'Удалить таблицу';
        tableDeleteBtn.innerHTML = SVG_TRASH;
        tableDeleteBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (selectedTable) {
                selectedTable.remove();
                deselectTable();
                scheduleSave();
            }
        });
        document.body.appendChild(tableAddColBtn);
        document.body.appendChild(tableAddRowBtn);
        document.body.appendChild(tableDeleteBtn);
    }

    function showTableAddButtons(table) {
        if (!table) return;
        createTableAddButtons();
        const rect = table.getBoundingClientRect();
        const btnSize = 26;
        tableAddColBtn.style.left = clampX(rect.right + 6, btnSize) + 'px';
        tableAddColBtn.style.top = clampY(rect.top + rect.height / 2 - btnSize / 2, btnSize) + 'px';
        tableAddColBtn.classList.add('show');
        tableAddRowBtn.style.left = clampX(rect.left + rect.width / 2 - btnSize / 2, btnSize) + 'px';
        tableAddRowBtn.style.top = clampY(rect.bottom + 6, btnSize) + 'px';
        tableAddRowBtn.classList.add('show');
        tableDeleteBtn.style.left = clampX(rect.right + 6, btnSize) + 'px';
        tableDeleteBtn.style.top = clampY(rect.top - btnSize - 6, btnSize) + 'px';
        tableDeleteBtn.classList.add('show');
    }

    function hideTableAddButtons() {
        if (tableAddColBtn) tableAddColBtn.classList.remove('show');
        if (tableAddRowBtn) tableAddRowBtn.classList.remove('show');
        if (tableDeleteBtn) tableDeleteBtn.classList.remove('show');
    }

    function selectTable(table) {
        if (selectedTable === table) {
            showTableAddButtons(table);
            return;
        }
        deselectTable();
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectLink();
        selectedTable = table;
        showTableAddButtons(table);
    }

    function deselectTable() {
        if (selectedTable) {
            selectedTable = null;
        }
        hideTableAddButtons();
    }

    function addColumnToTable(table) {
        if (!table) return;
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
            const isHeader = row.parentElement.tagName === 'THEAD' ||
                (row.parentElement.tagName === 'TABLE' && row.rowIndex === 0);
            const cell = document.createElement(isHeader ? 'th' : 'td');
            cell.innerHTML = '<br>';
            row.appendChild(cell);
        });
        showTableAddButtons(table);
        editor.focus();
        scheduleSave();
    }

    function addRowToTable(table) {
        if (!table) return;
        const tbody = table.querySelector('tbody') || table;
        const lastRow = tbody.querySelector('tr:last-child');
        if (!lastRow) return;
        const newRow = document.createElement('tr');
        const colCount = lastRow.children.length || 1;
        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.innerHTML = '<br>';
            newRow.appendChild(cell);
        }
        tbody.appendChild(newRow);
        showTableAddButtons(table);
        editor.focus();
        scheduleSave();
    }

    function insertTable(range, rows, cols) {
        rows = rows || 3;
        cols = cols || 3;
        const table = document.createElement('table');
        table.className = 'inserted-table';
        table.contentEditable = 'true';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const th = document.createElement('th');
            th.innerHTML = '<br>';
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (let r = 0; r < rows - 1; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.innerHTML = '<br>';
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        range.deleteContents();
        range.insertNode(table);
        placeCaretAfter(table);
        editor.focus();
        selectTable(table);
        scheduleSave();
        return table;
    }

    function onResizeStart(e) {
        e.preventDefault();
        e.stopPropagation();
        const target = selectedImage || selectedVideo;
        if (!target) return;
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = target.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        if (target.style.height && target.style.height !== 'auto') {
            startRatio = parseFloat(target.style.width) / parseFloat(target.style.height);
        } else {
            startRatio = startWidth / startHeight;
        }
    }

    function onResizeMove(e) {
        if (!isResizing) return;
        const target = selectedImage || selectedVideo;
        if (!target) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        let newWidth = startWidth + dx;
        if (newWidth < 30) newWidth = 30;
        let newHeight = newWidth / startRatio;
        target.style.width = newWidth + 'px';
        target.style.height = newHeight + 'px';
        showHandles(target);
    }

    function onResizeEnd() {
        if (!isResizing) return;
        isResizing = false;
        scheduleSave();
    }

    function onAlignClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const target = selectedImage || selectedVideo;
        if (!target) return;
        const currentAlign = target.dataset.align || 'left';
        let nextAlign;
        if (currentAlign === 'left') nextAlign = 'center';
        else if (currentAlign === 'center') nextAlign = 'right';
        else nextAlign = 'left';
        target.dataset.align = nextAlign;
        if (nextAlign === 'left') {
            target.style.display = 'block';
            target.style.marginLeft = '0';
            target.style.marginRight = 'auto';
        } else if (nextAlign === 'center') {
            target.style.display = 'block';
            target.style.marginLeft = 'auto';
            target.style.marginRight = 'auto';
        } else {
            target.style.display = 'block';
            target.style.marginLeft = 'auto';
            target.style.marginRight = '0';
        }
        showHandles(target);
        scheduleSave();
    }

    editor.addEventListener('click', (e) => {
        if (!isEditingEnabled) return;
        const target = e.target;
        if (target.tagName === 'IMG' && target.classList.contains('inserted-image')) {
            e.stopPropagation();
            selectImage(target);
            return;
        }
        const videoWrapper = target.closest && target.closest('.inserted-video');
        if (videoWrapper) {
            e.stopPropagation();
            if (!target.closest('.video-controls-overlay')) {
                selectVideo(videoWrapper);
            }
            return;
        }
        const fileEl = target.closest && target.closest('.inserted-file');
        if (fileEl) {
            e.stopPropagation();
            e.preventDefault();
            selectFile(fileEl);
            return;
        }
        const linkEl = target.closest && target.closest('.inserted-link');
        if (linkEl) {
            e.stopPropagation();
            e.preventDefault();
            selectLink(linkEl);
            return;
        }
        const tableEl = target.closest && target.closest('.inserted-table');
        if (tableEl) {
            deselectImage();
            deselectVideo();
            deselectFile();
            deselectLink();
            selectTable(tableEl);
            return;
        }
        if (target.closest && target.closest('.resize-handle')) return;
        if (target.closest && target.closest('.align-handle')) return;
        if (target.closest && target.closest('.delete-handle')) return;
        if (target.closest && target.closest('.table-add-col')) return;
        if (target.closest && target.closest('.table-add-row')) return;
        if (target.closest && target.closest('.table-delete-handle')) return;
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
    });

    editor.addEventListener('focusin', (e) => {
        if (!isEditingEnabled) return;
        const tableEl = e.target.closest && e.target.closest('.inserted-table');
        if (tableEl) {
            selectTable(tableEl);
        }
    });

    editor.addEventListener('keyup', () => {
        if (!isEditingEnabled) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const node = sel.anchorNode;
        if (!node) return;
        const el = node.nodeType === 1 ? node : node.parentElement;
        const tableEl = el && el.closest && el.closest('.inserted-table');
        if (tableEl) {
            selectTable(tableEl);
        }
    });

    editor.addEventListener('dblclick', (e) => {
        if (!isEditingEnabled) return;
        const fileEl = e.target.closest && e.target.closest('.inserted-file');
        if (!fileEl) return;
        e.preventDefault();
        e.stopPropagation();
        const url = fileEl.dataset.fileurl || fileEl.dataset.objectUrl;
        const name = fileEl.dataset.filename || 'file';
        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    editor.addEventListener('dblclick', (e) => {
        const linkEl = e.target.closest && e.target.closest('.inserted-link');
        if (!linkEl) return;
        e.preventDefault();
        e.stopPropagation();
        const url = linkEl.dataset.url;
        if (url) {
            window.open(url, '_blank');
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!isEditingEnabled) return;
        const target = e.target;
        if (target.closest && target.closest('.resize-handle')) return;
        if (target.closest && target.closest('.align-handle')) return;
        if (target.closest && target.closest('.delete-handle')) return;
        if (target.closest && target.closest('.table-add-col')) return;
        if (target.closest && target.closest('.table-add-row')) return;
        if (target.closest && target.closest('.table-delete-handle')) return;
        if (target.tagName === 'IMG' && target.classList.contains('inserted-image')) return;
        if (target.closest && target.closest('.inserted-video')) return;
        if (target.closest && target.closest('.inserted-file')) return;
        if (target.closest && target.closest('.inserted-link')) return;
        if (target.closest && target.closest('.inserted-table')) return;
        if (editor.contains(target)) return;
        deselectImage();
        deselectVideo();
        deselectFile();
        deselectTable();
        deselectLink();
    });

    function repositionHandles() {
        if (selectedImage) showHandles(selectedImage);
        if (selectedVideo) showHandles(selectedVideo);
        if (selectedLink) showDeleteOnly(selectedLink);
        if (selectedTable) showTableAddButtons(selectedTable);
    }

    editor.addEventListener('scroll', repositionHandles);
    window.addEventListener('scroll', repositionHandles);
    window.addEventListener('resize', () => {
        repositionHandles();
        hideContextMenu();
    });

    editor.addEventListener('input', () => {
        if (selectedImage && !editor.contains(selectedImage)) deselectImage();
        if (selectedVideo && !editor.contains(selectedVideo)) deselectVideo();
        if (selectedFile && !editor.contains(selectedFile)) deselectFile();
        if (selectedTable && !editor.contains(selectedTable)) deselectTable();
        if (selectedLink && !editor.contains(selectedLink)) deselectLink();
        if (!isInternalChange) {
            scheduleSave();
            scheduleHistoryPush();
        }
    });

    editor.addEventListener('paste', function (e) {
        e.preventDefault();
        const cd = e.clipboardData || window.clipboardData;
        if (!cd) return;
        let text = cd.getData('text/plain') || '';
        if (!text) return;
        text = text.replace(/\r\n?/g, '\n');
        const sel = window.getSelection();
        let range;
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            range = sel.getRangeAt(0);
        } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
        range.deleteContents();
        const frag = document.createDocumentFragment();
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) frag.appendChild(document.createElement('br'));
            if (lines[i].length > 0) {
                frag.appendChild(document.createTextNode(lines[i]));
            }
        }
        const lastNode = frag.lastChild;
        range.insertNode(frag);
        if (lastNode) {
            const after = document.createRange();
            after.setStartAfter(lastNode);
            after.collapse(true);
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(after);
            }
        }
        if (!isInternalChange) {
            scheduleSave();
            scheduleHistoryPush();
        }
    });

    const observer = new MutationObserver(() => {
        if (selectedImage && !editor.contains(selectedImage)) deselectImage();
        if (selectedVideo && !editor.contains(selectedVideo)) deselectVideo();
        if (selectedFile && !editor.contains(selectedFile)) deselectFile();
        if (selectedTable && !editor.contains(selectedTable)) deselectTable();
        if (selectedLink && !editor.contains(selectedLink)) deselectLink();
        if (!isInternalChange) {
            scheduleSave();
            scheduleHistoryPush();
        }
    });
    observer.observe(editor, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'src', 'data-align', 'data-url', 'data-fileurl', 'data-filename', 'data-filesize', 'data-filetype'] });

    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        sidebar.classList.toggle('open', isOpen);
        mainArea.classList.toggle('shifted', isOpen);
        toggleBtn.classList.toggle('open', isOpen);
        toggleBtn.textContent = isOpen ? '‹' : '›';
        toggleBtn.title = isOpen ? 'Скрыть панель' : 'Открыть панель';
    });

    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
            savedRange = sel.getRangeAt(0).cloneRange();
            return true;
        }
        return false;
    }

    function restoreSelection() {
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
            return true;
        }
        return false;
    }

    function openLinkDialog(mode, range) {
        linkInsertMode = mode;
        linkInsertRange = range;
        linkTitleInput.value = '';
        linkUrlInput.value = '';
        linkDialogOverlay.classList.add('show');
        linkTitleInput.focus();
    }

    function closeLinkDialog() {
        linkDialogOverlay.classList.remove('show');
        linkInsertRange = null;
        linkInsertMode = null;
    }

    linkDialogCancel.addEventListener('click', closeLinkDialog);
    linkDialogOverlay.addEventListener('mousedown', (e) => {
        if (e.target === linkDialogOverlay) closeLinkDialog();
    });

    linkDialogApply.addEventListener('click', () => {
        const title = linkTitleInput.value.trim();
        let url = linkUrlInput.value.trim();
        if (!title && !url) {
            closeLinkDialog();
            return;
        }
        if (!url) url = title;
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        const linkEl = document.createElement('a');
        linkEl.className = 'inserted-link';
        linkEl.href = url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.dataset.url = url;
        linkEl.contentEditable = 'false';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'link-title';
        titleSpan.textContent = title || url;
        const urlSpan = document.createElement('span');
        urlSpan.className = 'link-url';
        urlSpan.textContent = url;
        linkEl.appendChild(titleSpan);
        linkEl.appendChild(urlSpan);
        const range = linkInsertRange || (function() {
            const sel = window.getSelection();
            if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
                return sel.getRangeAt(0);
            }
            const r = document.createRange();
            r.selectNodeContents(editor);
            r.collapse(false);
            return r;
        })();
        range.deleteContents();
        range.insertNode(linkEl);
        placeCaretAfter(linkEl);
        editor.focus();
        closeLinkDialog();
        selectLink(linkEl);
        scheduleSave();
    });

    function formatText(action) {
        if (!isEditingEnabled) return;
        if (action === 'table') {
            const sel = window.getSelection();
            let range;
            if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
                range = sel.getRangeAt(0);
            } else {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            insertTable(range);
            return;
        }
        if (action === 'link') {
            const sel = window.getSelection();
            let range;
            if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
                range = sel.getRangeAt(0);
            } else {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            openLinkDialog('format', range);
            return;
        }
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
            return;
        }
        applyFormatting(action);
    }

    function applyFormatting(action) {
        if (!isEditingEnabled) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const fragment = range.extractContents();
        const text = fragment.textContent || '';
        let wrapper = document.createElement('span');
        switch (action) {
            case 'bold': wrapper.style.fontWeight = 'bold'; break;
            case 'italic': wrapper.style.fontStyle = 'italic'; break;
            case 'underline': wrapper.style.textDecoration = 'underline'; break;
            case 'strikethrough': wrapper.style.textDecoration = 'line-through'; break;
            case 'code':
                wrapper.style.fontFamily = 'monospace';
                wrapper.style.background = '#e2e8f0';
                wrapper.style.padding = '2px 6px';
                wrapper.style.borderRadius = '4px';
                break;
            case 'highlight':
                wrapper.style.background = '#fef08a';
                wrapper.style.padding = '2px 4px';
                break;
            case 'uppercase': wrapper.style.textTransform = 'uppercase'; break;
            case 'lowercase': wrapper.style.textTransform = 'lowercase'; break;
            case 'larger':
                wrapper.style.fontSize = '24px';
                wrapper.style.fontWeight = 'bold';
                break;
            case 'smaller':
                wrapper.style.fontSize = '14px';
                wrapper.style.color = '#64748b';
                break;
            default:
                wrapper.textContent = text;
        }
        wrapper.textContent = text;
        range.insertNode(wrapper);
        range.setStart(wrapper, 0);
        range.setEnd(wrapper, wrapper.childNodes.length || 0);
        sel.removeAllRanges();
        sel.addRange(range);
        floatingToolbar.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.action === action) {
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 500);
            }
        });
        hideFloatingToolbar();
        editor.focus();
        scheduleSave();
    }

    function positionToolbarNearSelection() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const toolbarWidth = floatingToolbar.offsetWidth || 400;
        const toolbarHeight = floatingToolbar.offsetHeight || 48;
        let top = rect.top - toolbarHeight - 12;
        let left = rect.left + rect.width / 2 - toolbarWidth / 2;
        if (top < 10) top = rect.bottom + 12;
        if (left < 10) left = 10;
        if (left + toolbarWidth > window.innerWidth - 10) {
            left = window.innerWidth - toolbarWidth - 10;
        }
        if (top + toolbarHeight > window.innerHeight - 10) {
            top = window.innerHeight - toolbarHeight - 10;
        }
        if (top < 10) top = 10;
        floatingToolbar.style.top = top + 'px';
        floatingToolbar.style.left = left + 'px';
        return true;
    }

    function showFloatingToolbar() {
        if (!isEditingEnabled) return;
        if (positionToolbarNearSelection()) {
            floatingToolbar.classList.add('show');
        }
    }

    function hideFloatingToolbar() {
        floatingToolbar.classList.remove('show');
    }

    editor.addEventListener('mouseup', handleSelection);
    editor.addEventListener('keyup', handleSelection);

    function handleSelection() {
        if (!isEditingEnabled) return;
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            const text = sel.toString().trim();
            if (text.length > 0) {
                showFloatingToolbar();
                return;
            }
        }
        hideFloatingToolbar();
    }

    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isEditingEnabled) return;
            const action = btn.dataset.action;
            if (action === 'download-vd5') {
                downloadVd5();
                return;
            }
            if (action === 'open-vd5') {
                vd5Input.value = '';
                vd5Input.click();
                return;
            }
            if (action === 'image') {
                pendingInsertAction = 'image';
                fileInput.accept = 'image/*';
                fileInput.value = '';
                fileInput.click();
                return;
            }
            if (action === 'file') {
                pendingInsertAction = 'file';
                fileInput.accept = '';
                fileInput.value = '';
                fileInput.click();
                return;
            }
            formatText(action);
        });
    });

    document.addEventListener('click', (e) => {
        if (!isEditingEnabled) return;
        const isToolbar = floatingToolbar.contains(e.target);
        const isEditor = editor.contains(e.target);
        const isSidebar = sidebar.contains(e.target);
        const isToggle = toggleBtn.contains(e.target);
        const isCtx = contextMenu.contains(e.target);
        const isLinkDialog = linkDialogOverlay.contains(e.target);
        const isTopControls = topControls.contains(e.target);
        const isResize = e.target.closest && e.target.closest('.resize-handle');
        const isAlign = e.target.closest && e.target.closest('.align-handle');
        const isDelete = e.target.closest && e.target.closest('.delete-handle');
        const isTableBtn = e.target.closest && (e.target.closest('.table-add-col') || e.target.closest('.table-add-row') || e.target.closest('.table-delete-handle'));
        const isVideoControl = e.target.closest && e.target.closest('.video-controls-overlay');
        if (!isToolbar && !isEditor && !isSidebar && !isToggle && !isCtx && !isLinkDialog && !isTopControls && !isResize && !isAlign && !isDelete && !isTableBtn && !isVideoControl) {
            hideFloatingToolbar();
            hideContextMenu();
            deselectImage();
            deselectVideo();
            deselectFile();
            deselectTable();
            deselectLink();
        }
    });

    editor.addEventListener('input', () => {
        if (!isEditingEnabled) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
            hideFloatingToolbar();
        }
    });

    sidebar.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function showContextMenu(x, y) {
        if (!isEditingEnabled) return;
        contextMenu.classList.add('show');
        const menuWidth = contextMenu.offsetWidth || 230;
        const menuHeight = contextMenu.offsetHeight || 150;
        let left = x;
        let top = y;
        if (left + menuWidth > window.innerWidth - 10) {
            left = window.innerWidth - menuWidth - 10;
        }
        if (top + menuHeight > window.innerHeight - 10) {
            top = window.innerHeight - menuHeight - 10;
        }
        if (left < 10) left = 10;
        if (top < 10) top = 10;
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
    }

    function hideContextMenu() {
        contextMenu.classList.remove('show');
    }

    editor.addEventListener('contextmenu', (e) => {
        if (!isEditingEnabled) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        hideFloatingToolbar();
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            contextMenuRange = sel.getRangeAt(0).cloneRange();
        } else {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            contextMenuRange = range;
        }
        showContextMenu(e.clientX, e.clientY);
    });

    contextMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isEditingEnabled) return;
            const action = btn.dataset.ctx;
            hideContextMenu();
            if (action === 'cancel') {
                contextMenuRange = null;
                pendingInsertAction = null;
                return;
            }
            if (action === 'table') {
                let range = contextMenuRange;
                if (!range || !editor.contains(range.startContainer)) {
                    range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                }
                contextMenuRange = null;
                pendingInsertAction = null;
                insertTable(range);
                return;
            }
            if (action === 'link') {
                let range = contextMenuRange;
                if (!range || !editor.contains(range.startContainer)) {
                    range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                }
                contextMenuRange = null;
                pendingInsertAction = null;
                openLinkDialog('context', range);
                return;
            }
            if (action === 'image') {
                pendingInsertAction = 'image';
                fileInput.accept = 'image/*';
            } else {
                pendingInsertAction = 'file';
                fileInput.accept = '';
            }
            fileInput.value = '';
            fileInput.click();
        });
    });

    document.addEventListener('mousedown', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    editor.addEventListener('scroll', hideContextMenu);

    function placeCaretAfter(node) {
        const sel = window.getSelection();
        if (!sel) return;
        const br = document.createElement('br');
        node.parentNode.insertBefore(br, node.nextSibling);
        const space = document.createTextNode('\u200B');
        br.parentNode.insertBefore(space, br.nextSibling);
        const range = document.createRange();
        range.setStart(space, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function getFileIcon(file) {
        return SVG_FILE;
    }

    function uploadFileToServer(file) {
        return new Promise((resolve, reject) => {
            const fd = new FormData();
            fd.append('file', file);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', apiOptions.uploadUrl || '/upload', true);
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const resp = JSON.parse(xhr.responseText);
                        resolve(resp);
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = () => reject(new Error('network error'));
            xhr.send(fd);
        });
    }

    function uploadBlobToServer(blob, opts) {
        return new Promise((resolve, reject) => {
            const fd = new FormData();
            const name = opts && opts.fileName
                ? opts.fileName.replace(/(\.\w+)?$/, (opts.original ? '$1' : '-preview$1'))
                : 'image.png';
            fd.append('file', blob, name);
            fd.append('original', opts && opts.original ? '1' : '0');
            const xhr = new XMLHttpRequest();
            xhr.open('POST', apiOptions.uploadUrl || '/upload', true);
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const resp = JSON.parse(xhr.responseText);
                        resolve(resp);
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = () => reject(new Error('network error'));
            xhr.send(fd);
        });
    }

    function initVideoPlayerControls(videoWrapper) {
        const video = videoWrapper.querySelector('video');
        if (!video) return;

        let controlsOverlay = videoWrapper.querySelector('.video-controls-overlay');
        if (!controlsOverlay) {
            controlsOverlay = document.createElement('div');
            controlsOverlay.className = 'video-controls-overlay';
            controlsOverlay.innerHTML = `
            <div class="video-progress-area">
                <div class="video-time-display video-time-current">0:00</div>
                <div class="video-progress-bar">
                    <div class="video-progress-fill"></div>
                </div>
                <div class="video-time-display video-time-duration">0:00</div>
            </div>
            <div class="video-buttons-row">
                <div class="video-control-group">
                    <button class="video-icon-btn video-mute-btn" title="Вкл/выкл звук">
                        <svg class="video-volume-icon" viewBox="0 0 24 24">
                            <path d="${ICON_VOLUME}"/>
                        </svg>
                    </button>
                    <div class="video-volume-wrapper">
                        <div class="video-volume-fill"></div>
                        <input type="range" class="video-volume-slider" min="0" max="1" step="0.01" value="1">
                    </div>
                </div>
                <div class="video-control-group">
                    <select class="video-speed-select">
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                    </select>
                </div>
            </div>
            `;
            videoWrapper.appendChild(controlsOverlay);
        }

        const timeCurrent = controlsOverlay.querySelector('.video-time-current');
        const timeDuration = controlsOverlay.querySelector('.video-time-duration');
        const progressBar = controlsOverlay.querySelector('.video-progress-bar');
        const progressFill = controlsOverlay.querySelector('.video-progress-fill');
        const muteBtn = controlsOverlay.querySelector('.video-mute-btn');
        const volumeIcon = controlsOverlay.querySelector('.video-volume-icon');
        const volumeSlider = controlsOverlay.querySelector('.video-volume-slider');
        const volumeFill = controlsOverlay.querySelector('.video-volume-fill');
        const speedSelect = controlsOverlay.querySelector('.video-speed-select');

        function formatTimeLocal(seconds) {
            if (!isFinite(seconds) || seconds < 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        let rafId = null;
        function smoothProgress() {
            if (!video.src) {
                rafId = requestAnimationFrame(smoothProgress);
                return;
            }
            const duration = video.duration;
            const currentTime = video.currentTime;
            if (duration && isFinite(duration)) {
                timeDuration.textContent = formatTimeLocal(duration);
            }
            timeCurrent.textContent = formatTimeLocal(currentTime);
            if (duration && isFinite(duration) && duration > 0) {
                const percent = (currentTime / duration) * 100;
                progressFill.style.width = `${percent}%`;
            }
            rafId = requestAnimationFrame(smoothProgress);
        }
        rafId = requestAnimationFrame(smoothProgress);

        function updateVolumeUI() {
            const muted = video.muted || video.volume === 0;
            volumeIcon.querySelector('path').setAttribute('d', muted ? ICON_MUTED : ICON_VOLUME);
            const val = muted ? 0 : video.volume;
            volumeSlider.value = val;
            volumeFill.style.width = `${val * 100}%`;
        }

        function setPlaybackRate(rate) {
            video.playbackRate = rate;
            for (let i = 0; i < speedSelect.options.length; i++) {
                const opt = speedSelect.options[i];
                if (parseFloat(opt.value) === rate) {
                    speedSelect.selectedIndex = i;
                    break;
                }
            }
        }

        setPlaybackRate(1);
        updateVolumeUI();

        video.addEventListener('loadedmetadata', () => {
            setPlaybackRate(1);
            speedSelect.value = '1';
        });

        video.addEventListener('volumechange', updateVolumeUI);

        video.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.paused) {
                video.play().catch(e => console.log('Ошибка воспроизведения:', e));
            } else {
                video.pause();
            }
        });

        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
        });

        volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseFloat(e.target.value);
            video.volume = val;
            video.muted = (val === 0);
            volumeFill.style.width = `${val * 100}%`;
        });

        controlsOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        speedSelect.addEventListener('change', (e) => {
            setPlaybackRate(parseFloat(e.target.value));
        });

        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!video.src || !video.duration || !isFinite(video.duration)) return;
            const rect = progressBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const percent = Math.min(1, Math.max(0, x / width));
            video.currentTime = percent * video.duration;
        });

        progressBar.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    function initializeAllVideos() {
        const videos = editor.querySelectorAll('.inserted-video');
        videos.forEach(vw => {
            const video = vw.querySelector('video');
            if (video && !vw.querySelector('.video-controls-overlay')) {
                initVideoPlayerControls(vw);
            }
        });
    }

    function insertMediaFile(file, range) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const sizeStr = formatFileSize(file.size);

        if (isImage && window.ImageEditor && file.type !== 'image/gif') {
            const objectUrl = URL.createObjectURL(file);
            const savedRange = range.cloneRange();

            window.ImageEditor.open({
                src: objectUrl,
                fileName: file.name,
                mimeType: file.type,
                uploader: uploadBlobToServer,
                onDone: function (result) {
                    URL.revokeObjectURL(objectUrl);
                    if (!result || result.cancelled) {
                        return;
                    }
                    const img = document.createElement('img');
                    img.src = result.url;
                    img.alt = result.name;
                    img.className = 'inserted-image';
                    img.title = result.name;
                    img.style.width = '300px';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.marginLeft = '0';
                    img.style.marginRight = 'auto';
                    img.dataset.align = 'left';
                    img.dataset.fileurl = result.url;

                    const sel = window.getSelection();
                    if (sel) sel.removeAllRanges();
                    savedRange.deleteContents();
                    savedRange.insertNode(img);
                    placeCaretAfter(img);
                    if (isEditingEnabled) selectImage(img);
                    editor.focus();
                    scheduleSave();
                }
            });
            return;
        }

        const placeholder = document.createElement('span');
        placeholder.className = 'inserted-file uploading';
        placeholder.contentEditable = 'false';
        placeholder.innerHTML =
            '<span class="file-icon">' + getFileIcon(file) + '</span>' +
            '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
            '<span class="file-size">' + sizeStr + '</span>';
        range.deleteContents();
        range.insertNode(placeholder);
        placeCaretAfter(placeholder);

        uploadFileToServer(file).then((resp) => {
            const fileUrl = resp.url;
            const fileName = resp.name || file.name;
            const fileSize = resp.size || file.size;
            const fileType = resp.type || file.type || '';
            if (isVideo) {
                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'inserted-video';
                videoWrapper.style.width = '400px';
                videoWrapper.style.height = '250px';
                videoWrapper.style.display = 'block';
                videoWrapper.style.marginLeft = '0';
                videoWrapper.style.marginRight = 'auto';
                videoWrapper.dataset.align = 'left';
                videoWrapper.dataset.fileurl = fileUrl;

                const video = document.createElement('video');
                video.src = fileUrl;
                video.preload = 'metadata';
                video.playsinline = true;
                video.controls = false;
                videoWrapper.appendChild(video);

                placeholder.parentNode.replaceChild(videoWrapper, placeholder);
                placeCaretAfter(videoWrapper);

                initVideoPlayerControls(videoWrapper);
                if (isEditingEnabled) selectVideo(videoWrapper);
            } else {
                const fileEl = document.createElement('a');
                fileEl.className = 'inserted-file';
                fileEl.href = fileUrl;
                fileEl.title = fileName + ' (двойной клик — открыть)';
                fileEl.dataset.filename = fileName;
                fileEl.dataset.filesize = fileSize;
                fileEl.dataset.filetype = fileType;
                fileEl.dataset.fileurl = fileUrl;
                fileEl.contentEditable = 'false';
                const iconSrc = getFileIcon({ name: fileName, type: fileType });
                fileEl.innerHTML =
                    '<span class="file-icon">' + iconSrc + '</span>' +
                    '<span class="file-name">' + escapeHtml(fileName) + '</span>' +
                    '<span class="file-size">' + formatFileSize(fileSize) + '</span>';
                placeholder.parentNode.replaceChild(fileEl, placeholder);
                placeCaretAfter(fileEl);
            }
            editor.focus();
            scheduleSave();
        }).catch(() => {
            placeholder.classList.remove('uploading');
            placeholder.classList.add('error');
            placeholder.querySelector('.file-size').textContent = 'ошибка';
        });
    }

    fileInput.addEventListener('change', () => {
        if (!isEditingEnabled) return;
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            contextMenuRange = null;
            pendingInsertAction = null;
            return;
        }
        let range = null;
        const sel = window.getSelection();
        if (contextMenuRange) {
            sel.removeAllRanges();
            sel.addRange(contextMenuRange);
            range = contextMenuRange;
        } else if (pendingInsertAction) {
            if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
                range = sel.getRangeAt(0);
            } else {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
        } else {
            contextMenuRange = null;
            pendingInsertAction = null;
            return;
        }
        if (!range) return;
        insertMediaFile(file, range);
        contextMenuRange = null;
        pendingInsertAction = null;
        fileInput.value = '';
        fileInput.accept = '';
    });

    function formatFileSize(bytes) {
        bytes = parseInt(bytes, 10) || 0;
        if (bytes === 0) return '0 Б';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getRangeFromPoint(x, y) {
        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }
        }
        return range;
    }

    let dragSourceElement = null;
    let dragSourceType = null;
    let dragStartX = 0, dragStartY = 0;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isDragging = false;
    let dragGhostElement = null;

    function updateDropPlaceholder(range) {
        if (!dropPlaceholder) {
            dropPlaceholder = dragSourceElement.cloneNode(true);
            dropPlaceholder.classList.add('drop-placeholder');
            dropPlaceholder.style.pointerEvents = 'none';
        }
        if (dropPlaceholder.parentNode) {
            dropPlaceholder.parentNode.removeChild(dropPlaceholder);
        }
        if (range.startContainer === dropPlaceholder || (range.startContainer.parentNode && range.startContainer.parentNode === dropPlaceholder)) {
            return;
        }
        range.insertNode(dropPlaceholder);
    }

    function removeDropPlaceholder() {
        if (dropPlaceholder && dropPlaceholder.parentNode) {
            dropPlaceholder.parentNode.removeChild(dropPlaceholder);
        }
        dropPlaceholder = null;
    }

    function updateDropTarget(clientX, clientY) {
        const range = getRangeFromPoint(clientX, clientY);
        if (range && editor.contains(range.startContainer)) {
            dropTargetRange = range;
            updateDropPlaceholder(range);
        } else {
            dropTargetRange = null;
            removeDropPlaceholder();
        }
    }

    function updateDragPreviewPosition(clientX, clientY) {
        if (dragPreview.classList.contains('show')) {
            dragPreview.style.left = (clientX + 16) + 'px';
            dragPreview.style.top = (clientY + 16) + 'px';
        }
    }

    function handleDragEnter(e) {
        e.preventDefault();
        dragCounter++;
        if (!isDragOver) {
            isDragOver = true;
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
        updateDropTarget(e.clientX, e.clientY);
        updateDragPreviewPosition(e.clientX, e.clientY);
        const items = e.dataTransfer && e.dataTransfer.items;
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        if (file.type.startsWith('image/')) {
                            if (dragPreview.dataset.previewSrc !== 'image') {
                                dragPreview.dataset.previewSrc = 'image';
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    dragPreview.src = ev.target.result;
                                    dragPreview.classList.add('show');
                                };
                                reader.readAsDataURL(file);
                            }
                            dragPreview.style.left = (e.clientX + 16) + 'px';
                            dragPreview.style.top = (e.clientY + 16) + 'px';
                            dragPreview.style.width = 'auto';
                            dragPreview.style.height = 'auto';
                        } else if (file.type.startsWith('video/')) {
                            if (dragPreview.dataset.previewSrc !== 'video') {
                                dragPreview.dataset.previewSrc = 'video';
                                dragPreview.src = '';
                                dragPreview.classList.remove('show');
                            }
                        } else {
                            if (dragPreview.dataset.previewSrc !== 'file') {
                                dragPreview.dataset.previewSrc = 'file';
                                dragPreview.src = '';
                                dragPreview.classList.remove('show');
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    function handleDragLeave(e) {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            isDragOver = false;
            dragPreview.classList.remove('show');
            dragPreview.removeAttribute('data-preview-src');
            dropTargetRange = null;
            removeDropPlaceholder();
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        isDragOver = false;
        dragPreview.classList.remove('show');
        dragPreview.removeAttribute('data-preview-src');
        removeDropPlaceholder();
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) return;

        let range = dropTargetRange;
        if (!range || !editor.contains(range.startContainer)) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
        const container = range.startContainer;
        if (container.nodeType === 1) {
            const fileParent = container.closest && container.closest('.inserted-file');
            if (fileParent) {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
        } else if (container.parentElement && container.parentElement.closest && container.parentElement.closest('.inserted-file')) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        const filesArr = Array.from(files);
        const firstFile = filesArr[0];
        const isSingleImage = filesArr.length === 1 && firstFile.type.startsWith('image/') && firstFile.type !== 'image/gif';

        if (isSingleImage && window.ImageEditor) {
            range.deleteContents();
            range.collapse(false);
            insertMediaFile(firstFile, range);
            dropTargetRange = null;
            return;
        }

        range.deleteContents();
        filesArr.forEach((file, idx) => {
            if (idx === 0) {
                insertMediaFile(file, range);
            } else {
                const newRange = document.createRange();
                newRange.selectNodeContents(editor);
                newRange.collapse(false);
                insertMediaFile(file, newRange);
            }
        });
        dropTargetRange = null;
    }

    editorContainer.addEventListener('dragenter', handleDragEnter);
    editorContainer.addEventListener('dragover', handleDragOver);
    editorContainer.addEventListener('dragleave', handleDragLeave);
    editorContainer.addEventListener('drop', handleDrop);
    document.addEventListener('dragenter', (e) => {
        if (e.target.closest && e.target.closest('.img-editor-overlay')) return;
        e.preventDefault();
    });
    document.addEventListener('dragover', (e) => {
        if (e.target.closest && e.target.closest('.img-editor-overlay')) return;
        e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
        if (e.target.closest && e.target.closest('.img-editor-overlay')) return;
        if (!editorContainer.contains(e.target)) {
            e.preventDefault();
        }
    });

    function startInternalDrag(e, element, type) {
        dragSourceElement = element;
        dragSourceType = type;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = element.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        isDragging = false;
    }

    function onInternalDragMove(e) {
        if (!dragSourceElement) return;
        const dx = Math.abs(e.clientX - dragStartX);
        const dy = Math.abs(e.clientY - dragStartY);
        if (!isDragging && (dx > 5 || dy > 5)) {
            isDragging = true;
            createDragGhost();
        }
        if (isDragging) {
            updateDragGhost(e.clientX, e.clientY);
            updateDropTarget(e.clientX, e.clientY);
        }
    }

    function onInternalDragEnd(e) {
        if (!dragSourceElement) return;
        if (isDragging && dropTargetRange && dropPlaceholder) {
            let range = dropTargetRange;
            if (!editor.contains(range.startContainer) || range.startContainer === dropPlaceholder || (range.startContainer.parentNode && range.startContainer.parentNode === dropPlaceholder)) {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            if (dropPlaceholder.parentNode) {
                dropPlaceholder.parentNode.removeChild(dropPlaceholder);
            }
            range.insertNode(dragSourceElement);
            placeCaretAfter(dragSourceElement);
            scheduleSave();
        }
        destroyDragGhost();
        removeDropPlaceholder();
        dragSourceElement = null;
        dragSourceType = null;
        isDragging = false;
        dropTargetRange = null;
    }

    function createDragGhost() {
        if (dragGhostElement) return;
        dragGhostElement = dragSourceElement.cloneNode(true);
        dragGhostElement.style.position = 'fixed';
        dragGhostElement.style.pointerEvents = 'none';
        dragGhostElement.style.opacity = '0.55';
        dragGhostElement.style.zIndex = '1002';
        dragGhostElement.style.borderRadius = '8px';
        dragGhostElement.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        dragGhostElement.style.transform = 'scale(0.9)';
        dragGhostElement.style.maxWidth = '200px';
        dragGhostElement.style.maxHeight = '150px';
        dragGhostElement.style.objectFit = 'contain';
        const rect = dragSourceElement.getBoundingClientRect();
        dragGhostElement.style.width = rect.width + 'px';
        dragGhostElement.style.height = rect.height + 'px';
        document.body.appendChild(dragGhostElement);
    }

    function updateDragGhost(clientX, clientY) {
        if (!dragGhostElement) return;
        dragGhostElement.style.left = (clientX - dragOffsetX) + 'px';
        dragGhostElement.style.top = (clientY - dragOffsetY) + 'px';
    }

    function destroyDragGhost() {
        if (dragGhostElement && dragGhostElement.parentNode) {
            dragGhostElement.parentNode.removeChild(dragGhostElement);
        }
        dragGhostElement = null;
    }

    editor.addEventListener('mousedown', (e) => {
        if (!isEditingEnabled) return;
        const target = e.target;
        if (target.closest && target.closest('.resize-handle')) return;
        if (target.closest && target.closest('.align-handle')) return;
        if (target.closest && target.closest('.delete-handle')) return;
        if (target.closest && target.closest('.table-add-col')) return;
        if (target.closest && target.closest('.table-add-row')) return;
        if (target.closest && target.closest('.table-delete-handle')) return;
        if (target.tagName === 'IMG' && target.classList.contains('inserted-image')) {
            selectImage(target);
            startInternalDrag(e, target, 'image');
            return;
        }
        const videoWrapper = target.closest && target.closest('.inserted-video');
        if (videoWrapper) {
            if (!target.closest('.video-controls-overlay')) {
                selectVideo(videoWrapper);
            }
            startInternalDrag(e, videoWrapper, 'video');
            return;
        }
        const fileEl = target.closest && target.closest('.inserted-file');
        if (fileEl) {
            startInternalDrag(e, fileEl, 'file');
            return;
        }
        const linkEl = target.closest && target.closest('.inserted-link');
        if (linkEl) {
            startInternalDrag(e, linkEl, 'link');
            return;
        }
        const tableEl = target.closest && target.closest('.inserted-table');
        if (tableEl) {
            startInternalDrag(e, tableEl, 'table');
            return;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (dragSourceElement) {
            onInternalDragMove(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (dragSourceElement) {
            onInternalDragEnd(e);
        }
    });

    editor.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });

    function hideFilePreview() {
        filePreviewTooltip.classList.remove('show');
        previewTooltipTarget = null;
        if (previewTooltipTimer) {
            clearTimeout(previewTooltipTimer);
            previewTooltipTimer = null;
        }
    }

    function positionFilePreview(rect) {
        const tooltipRect = filePreviewTooltip.getBoundingClientRect();
        let left = rect.left;
        let top = rect.bottom + 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (left < 10) left = 10;
        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = rect.top - tooltipRect.height - 10;
        }
        if (top < 10) top = 10;
        filePreviewTooltip.style.left = left + 'px';
        filePreviewTooltip.style.top = top + 'px';
    }

    function isPreviewableFile(fileType, fileName) {
        const type = (fileType || '').toLowerCase();
        const name = (fileName || '').toLowerCase();
        if (type.startsWith('text/')) return true;
        if (type.startsWith('image/')) return true;
        if (type.startsWith('video/')) return true;
        if (type.startsWith('audio/')) return true;
        if (type.includes('pdf')) return true;
        if (type.includes('json')) return true;
        if (type.includes('xml')) return true;
        if (type.includes('javascript')) return true;
        if (type.includes('html')) return true;
        if (type.includes('css')) return true;
        if (name.endsWith('.txt')) return true;
        if (name.endsWith('.md')) return true;
        if (name.endsWith('.log')) return true;
        if (name.endsWith('.csv')) return true;
        if (name.endsWith('.json')) return true;
        if (name.endsWith('.xml')) return true;
        if (name.endsWith('.js')) return true;
        if (name.endsWith('.ts')) return true;
        if (name.endsWith('.html')) return true;
        if (name.endsWith('.css')) return true;
        if (name.endsWith('.py')) return true;
        if (name.endsWith('.java')) return true;
        if (name.endsWith('.c')) return true;
        if (name.endsWith('.cpp')) return true;
        if (name.endsWith('.h')) return true;
        if (name.endsWith('.pdf')) return true;
        return false;
    }

    function getFileCategory(fileType, fileName) {
        const type = (fileType || '').toLowerCase();
        const name = (fileName || '').toLowerCase();
        if (type.startsWith('image/')) return 'image';
        if (type.startsWith('video/')) return 'video';
        if (type.startsWith('audio/')) return 'audio';
        if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
        if (type.startsWith('text/') || type.includes('json') || type.includes('xml') ||
            type.includes('javascript') || type.includes('html') || type.includes('css') ||
            name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.log') ||
            name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') ||
            name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.html') ||
            name.endsWith('.css') || name.endsWith('.py') || name.endsWith('.java') ||
            name.endsWith('.c') || name.endsWith('.cpp') || name.endsWith('.h')) return 'text';
        return 'other';
    }

    function escapeHtmlText(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showFilePreviewLoading() {
        filePreviewTooltip.querySelector('.preview-body').innerHTML =
            '<div class="preview-loading"><span class="spinner"></span><span>Загрузка предпросмотра…</span></div>';
    }

    function renderTextPreview(text, maxChars) {
        const limit = maxChars || 1200;
        let display = text;
        let truncated = false;
        if (display.length > limit) {
            display = display.slice(0, limit);
            truncated = true;
        }
        let html = '<div class="text-preview">' + escapeHtmlText(display) + '</div>';
        if (truncated) {
            html += '<div style="margin-top:6px;color:#94a3b8;font-size:11px;">… ещё ' +
                (text.length - limit) + ' символов</div>';
        }
        return html;
    }

    function loadFilePreviewData(fileEl) {
        const fileUrl = fileEl.dataset.fileurl || fileEl.dataset.objectUrl;
        const fileName = fileEl.dataset.filename || 'file';
        const fileType = fileEl.dataset.filetype || '';
        const fileSize = parseInt(fileEl.dataset.filesize || '0', 10);
        const requestId = ++previewTooltipRequestId;
        filePreviewTooltip.querySelector('.preview-name').textContent = fileName;
        filePreviewTooltip.querySelector('.preview-type').textContent = fileType || 'неизвестный тип';
        filePreviewTooltip.querySelector('.preview-size').textContent = formatFileSize(fileSize);
        if (!fileUrl) {
            filePreviewTooltip.querySelector('.preview-body').innerHTML =
                '<div style="color:#94a3b8;font-size:12px;">Предпросмотр недоступен</div>';
            return;
        }
        const category = getFileCategory(fileType, fileName);
        if (category === 'image') {
            const img = document.createElement('img');
            img.onload = () => {
                if (requestId !== previewTooltipRequestId) return;
                filePreviewTooltip.querySelector('.preview-body').innerHTML = '';
                filePreviewTooltip.querySelector('.preview-body').appendChild(img);
                if (previewTooltipTarget) positionFilePreview(previewTooltipTarget.getBoundingClientRect());
            };
            img.onerror = () => {
                if (requestId !== previewTooltipRequestId) return;
                filePreviewTooltip.querySelector('.preview-body').innerHTML =
                    '<div style="color:#94a3b8;font-size:12px;">Не удалось загрузить изображение</div>';
            };
            img.src = fileUrl;
            return;
        }
        if (category === 'video') {
            const video = document.createElement('video');
            video.src = fileUrl;
            video.controls = false;
            video.muted = true;
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                if (requestId !== previewTooltipRequestId) return;
                filePreviewTooltip.querySelector('.preview-body').innerHTML = '';
                filePreviewTooltip.querySelector('.preview-body').appendChild(video);
                if (previewTooltipTarget) positionFilePreview(previewTooltipTarget.getBoundingClientRect());
            };
            video.onerror = () => {
                if (requestId !== previewTooltipRequestId) return;
                filePreviewTooltip.querySelector('.preview-body').innerHTML =
                    '<div style="color:#94a3b8;font-size:12px;">Не удалось загрузить видео</div>';
            };
            return;
        }
        if (category === 'audio') {
            const audio = document.createElement('audio');
            audio.src = fileUrl;
            audio.controls = true;
            audio.preload = 'metadata';
            if (requestId !== previewTooltipRequestId) return;
            filePreviewTooltip.querySelector('.preview-body').innerHTML = '';
            filePreviewTooltip.querySelector('.preview-body').appendChild(audio);
            if (previewTooltipTarget) positionFilePreview(previewTooltipTarget.getBoundingClientRect());
            return;
        }
        if (category === 'pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = fileUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
            iframe.style.width = '340px';
            iframe.style.height = '200px';
            iframe.style.border = 'none';
            if (requestId !== previewTooltipRequestId) return;
            filePreviewTooltip.querySelector('.preview-body').innerHTML = '';
            filePreviewTooltip.querySelector('.preview-body').appendChild(iframe);
            if (previewTooltipTarget) positionFilePreview(previewTooltipTarget.getBoundingClientRect());
            return;
        }
        if (category === 'text') {
            showFilePreviewLoading();
            fetch(fileUrl)
                .then((res) => res.text())
                .then((text) => {
                    if (requestId !== previewTooltipRequestId) return;
                    filePreviewTooltip.querySelector('.preview-body').innerHTML = renderTextPreview(text, 1200);
                    if (previewTooltipTarget) positionFilePreview(previewTooltipTarget.getBoundingClientRect());
                })
                .catch(() => {
                    if (requestId !== previewTooltipRequestId) return;
                    filePreviewTooltip.querySelector('.preview-body').innerHTML =
                        '<div style="color:#94a3b8;font-size:12px;">Не удалось прочитать файл</div>';
                });
            return;
        }
        filePreviewTooltip.querySelector('.preview-body').innerHTML =
            '<div style="color:#94a3b8;font-size:12px;">Предпросмотр для этого типа файла недоступен</div>';
    }

    function showFilePreview(fileEl) {
        if (!fileEl) return;
        previewTooltipTarget = fileEl;
        loadFilePreviewData(fileEl);
        filePreviewTooltip.classList.add('show');
        requestAnimationFrame(() => {
            if (previewTooltipTarget) {
                positionFilePreview(previewTooltipTarget.getBoundingClientRect());
            }
        });
    }

    editor.addEventListener('mouseover', (e) => {
        const fileEl = e.target.closest && e.target.closest('.inserted-file');
        if (!fileEl) return;
        if (!isPreviewableFile(fileEl.dataset.filetype, fileEl.dataset.filename)) return;
        if (previewTooltipTarget === fileEl) return;
        if (previewTooltipTimer) {
            clearTimeout(previewTooltipTimer);
        }
        previewTooltipTimer = setTimeout(() => {
            showFilePreview(fileEl);
        }, 350);
    });

    editor.addEventListener('mouseout', (e) => {
        const fileEl = e.target.closest && e.target.closest('.inserted-file');
        if (!fileEl) return;
        const related = e.relatedTarget;
        if (related && fileEl.contains(related)) return;
        if (related && related.closest && related.closest('.inserted-file') === fileEl) return;
        if (previewTooltipTimer) {
            clearTimeout(previewTooltipTimer);
            previewTooltipTimer = null;
        }
        hideFilePreview();
    });

    filePreviewTooltip.addEventListener('mouseenter', () => {
        if (previewTooltipTimer) {
            clearTimeout(previewTooltipTimer);
            previewTooltipTimer = null;
        }
    });

    filePreviewTooltip.addEventListener('mouseleave', () => {
        hideFilePreview();
    });

    editor.addEventListener('scroll', hideFilePreview);
    window.addEventListener('scroll', hideFilePreview);
    window.addEventListener('resize', hideFilePreview);

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest || !e.target.closest('.inserted-file')) {
            hideFilePreview();
        }
    });

    function showSaveIndicator(state, text) {
    }

    function hideSaveIndicator(delay) {
    }

    function collectDocumentState() {
        return {
            id: documentId,
            format: VD5_FORMAT,
            version: VD5_VERSION,
            savedAt: new Date().toISOString(),
            content: editor.innerHTML
        };
    }

    function saveToLocalStorage() {
        if (!apiOptions.storageKey) return;
        try {
            const state = collectDocumentState();
            localStorage.setItem(apiOptions.storageKey, JSON.stringify(state));
            if (typeof apiOptions.onSave === 'function') {
                apiOptions.onSave(state);
            }
        } catch (err) {
            console.warn('[save] localStorage failed:', err && err.name, err && err.message);
            if (err && err.name === 'QuotaExceededError') {
                console.warn('[save] localStorage quota exceeded');
            }
        }
    }

    function scheduleSave() {
        if (isInternalChange) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveToLocalStorage();
            saveTimer = null;
        }, 500);
    }

    function loadFromLocalStorage() {
        if (!apiOptions.storageKey) return false;
        try {
            const raw = localStorage.getItem(apiOptions.storageKey);
            if (!raw) return false;
            const state = JSON.parse(raw);
            if (state && typeof state.content === 'string') {
                isInternalChange = true;
                editor.innerHTML = state.content;
                isInternalChange = false;
                initializeAllVideos();
                pushHistoryState();
                return true;
            }
        } catch (err) {
            console.warn('[load] localStorage failed:', err && err.name, err && err.message);
            return false;
        }
        return false;
    }

    function downloadVd5() {
        const state = collectDocumentState();
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.href = url;
        a.download = 'document-' + stamp + '.vd5';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function openVd5File(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const state = JSON.parse(ev.target.result);
                if (!state || typeof state.content !== 'string') {
                    console.warn('[open-vd5] invalid file format');
                    return;
                }
                isInternalChange = true;
                editor.innerHTML = state.content;
                isInternalChange = false;
                deselectImage();
                deselectVideo();
                deselectFile();
                deselectTable();
                deselectLink();
                initializeAllVideos();
                pushHistoryState();
                scheduleSave();
            } catch (err) {
                console.warn('[open-vd5] read error:', err && err.message);
            }
        };
        reader.onerror = (err) => {
            console.warn('[open-vd5] file read error:', err);
        };
        reader.readAsText(file);
    }

    vd5Input.addEventListener('change', () => {
        if (!isEditingEnabled) return;
        const file = vd5Input.files && vd5Input.files[0];
        if (!file) return;
        openVd5File(file);
        vd5Input.value = '';
    });

    document.addEventListener('keydown', (e) => {
        if (!isEditingEnabled) return;
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        const key = (e.key || '').toLowerCase();
        if (key === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            return;
        }
        if (key === 'y') {
            e.preventDefault();
            redo();
            return;
        }
        if (key === 's') {
            e.preventDefault();
            if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
            }
            saveToLocalStorage();
            return;
        }
        if (key === 'o') {
            e.preventDefault();
            vd5Input.value = '';
            vd5Input.click();
            return;
        }
    });

    window.addEventListener('beforeunload', () => {
        if (saveTimer && isEditingEnabled) {
            clearTimeout(saveTimer);
            saveTimer = null;
            saveToLocalStorage();
        }
    });

    function setEditingEnabled(enabled) {
        isEditingEnabled = !!enabled;
        editor.contentEditable = isEditingEnabled ? 'true' : 'false';
        editor.classList.toggle('readonly', !isEditingEnabled);
        toggleBtn.style.display = isEditingEnabled ? 'flex' : 'none';
        sidebar.style.display = isEditingEnabled ? 'flex' : 'none';
        topControls.style.display = isEditingEnabled ? 'flex' : 'none';
        if (!isEditingEnabled) {
            hideFloatingToolbar();
            hideContextMenu();
            hideFilePreview();
            deselectImage();
            deselectVideo();
            deselectFile();
            deselectTable();
            deselectLink();
            hideTableAddButtons();
            hideHandles();
            if (isOpen) {
                isOpen = false;
                sidebar.classList.remove('open');
                mainArea.classList.remove('shifted');
                toggleBtn.classList.remove('open');
                toggleBtn.textContent = '›';
                toggleBtn.title = 'Открыть панель';
            }
        }
    }

    function normalizeHtml(html) {
        if (!html) return '';
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.querySelectorAll('div').forEach(function (div) {
            if (div.children.length === 0) {
                var br = document.createElement('br');
                div.parentNode.replaceChild(br, div);
            } else {
                var br = document.createElement('br');
                if (div.parentNode) {
                    div.parentNode.insertBefore(br, div);
                }
            }
        });
        tmp.querySelectorAll('p').forEach(function (p) {
            if (p.children.length === 0) {
                var br = document.createElement('br');
                p.parentNode.replaceChild(br, p);
            }
        });
        var result = tmp.innerHTML;
        result = result.replace(/\n/g, '<br>');
        return result;
    }

    const EditorAPI = {
        getHTML: function() {
            return normalizeHtml(editor.innerHTML);
        },
        setHTML: function(html) {
            isInternalChange = true;
            editor.innerHTML = html;
            isInternalChange = false;
            initializeAllVideos();
            pushHistoryState();
        },
        getText: function() {
            return editor.textContent;
        },
        setText: function(text) {
            isInternalChange = true;
            editor.textContent = text;
            isInternalChange = false;
            pushHistoryState();
        },
        isEditing: function() {
            return isEditingEnabled;
        },
        setEditing: function(enabled) {
            setEditingEnabled(enabled);
        },
        save: function() {
            saveToLocalStorage();
        },
        load: function() {
            return loadFromLocalStorage();
        },
        downloadVd5: function() {
            downloadVd5();
        },
        getId: function() {
            return documentId;
        },
        setId: function(id) {
            documentId = id;
        },
        undo: undo,
        redo: redo,
        destroy: function() {
            try {
                observer.disconnect();
                if (editorContainer) {
                    editorContainer.removeEventListener('dragenter', handleDragEnter);
                    editorContainer.removeEventListener('dragover', handleDragOver);
                    editorContainer.removeEventListener('dragleave', handleDragLeave);
                    editorContainer.removeEventListener('drop', handleDrop);
                }
                if (dragGhostElement && dragGhostElement.parentNode) {
                    dragGhostElement.parentNode.removeChild(dragGhostElement);
                }
                if (resizeHandle && resizeHandle.parentNode) resizeHandle.parentNode.removeChild(resizeHandle);
                if (alignHandle && alignHandle.parentNode) alignHandle.parentNode.removeChild(alignHandle);
                if (deleteHandle && deleteHandle.parentNode) deleteHandle.parentNode.removeChild(deleteHandle);
                if (tableAddColBtn && tableAddColBtn.parentNode) tableAddColBtn.parentNode.removeChild(tableAddColBtn);
                if (tableAddRowBtn && tableAddRowBtn.parentNode) tableAddRowBtn.parentNode.removeChild(tableAddRowBtn);
                if (tableDeleteBtn && tableDeleteBtn.parentNode) tableDeleteBtn.parentNode.removeChild(tableDeleteBtn);
                if (filePreviewTooltip && filePreviewTooltip.parentNode) filePreviewTooltip.parentNode.removeChild(filePreviewTooltip);
                if (dragPreview && dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                if (floatingToolbar && floatingToolbar.parentNode) floatingToolbar.parentNode.removeChild(floatingToolbar);
                if (contextMenu && contextMenu.parentNode) contextMenu.parentNode.removeChild(contextMenu);
                if (linkDialogOverlay && linkDialogOverlay.parentNode) linkDialogOverlay.parentNode.removeChild(linkDialogOverlay);
                if (saveIndicator && saveIndicator.parentNode) saveIndicator.parentNode.removeChild(saveIndicator);
                if (topControls && topControls.parentNode) topControls.parentNode.removeChild(topControls);
                if (sidebar && sidebar.parentNode) sidebar.parentNode.removeChild(sidebar);
                if (toggleBtn && toggleBtn.parentNode) toggleBtn.parentNode.removeChild(toggleBtn);
                if (mainArea && mainArea.parentNode) mainArea.parentNode.removeChild(mainArea);
            } catch (e) {}
        },
        element: editor
    };

    window.addEventListener('message', function(e) {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'setContent') {
            var html = e.data.html || '';
            isInternalChange = true;
            editor.innerHTML = html;
            isInternalChange = false;
            deselectImage(); deselectVideo(); deselectFile(); deselectTable(); deselectLink();
            initializeAllVideos();
            historyStack = []; historyIndex = -1;
            pushHistoryState();
            try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
        } else if (e.data.type === 'clearContent') {
            isInternalChange = true;
            editor.innerHTML = '';
            isInternalChange = false;
            historyStack = []; historyIndex = -1;
            pushHistoryState();
            try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
        }
    });

    window.VD5Editor = EditorAPI;

    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.has('admin');
    const requestedId = params.get('id') || params.get('doc_id') || params.get('document_id');
    const requestedPageType = params.get('page_type') || 'home';

    if (requestedId) {
        documentId = requestedId;
    }

    if (window.VD5_CONFIG) {
        apiOptions = Object.assign({}, window.VD5_CONFIG);
    }

    apiOptions.storageKey = apiOptions.storageKey || null;
    apiOptions.uploadUrl = apiOptions.uploadUrl || '/upload';
    apiOptions.onSave = function(state) {};

    if (apiOptions.initialContent) {
        editor.innerHTML = apiOptions.initialContent;
        initializeAllVideos();
        pushHistoryState();
        updateHistoryButtons();
        setEditingEnabled(isAdmin || apiOptions.editable === true);
    } else if (requestedId) {
        fetch('/api/' + encodeURIComponent(requestedPageType) + '_menu_text/' + encodeURIComponent(requestedId))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
                if (data && data.success && typeof data.text === 'string') {
                    editor.innerHTML = data.text;
                    initializeAllVideos();
                }
                pushHistoryState();
                updateHistoryButtons();
                setEditingEnabled(isAdmin || apiOptions.editable === true);
            })
            .catch(function() {
                pushHistoryState();
                updateHistoryButtons();
                setEditingEnabled(isAdmin || apiOptions.editable === true);
            });
    } else {
        pushHistoryState();
        updateHistoryButtons();
        setEditingEnabled(isAdmin || apiOptions.editable === true);
    }
})();
