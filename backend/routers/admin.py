from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import text
from database import engine
import html

router = APIRouter()


def get_tables():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"))
        return [row[0] for row in result]


def get_table_columns(table: str):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return [{'name': row[1], 'type': row[2]} for row in result]


def get_primary_key(table: str):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        for row in result:
            if row[5]:  # pk column
                return row[1]
        return None


def get_table_rows(table: str, page: int = 1, page_size: int = 50):
    offset = (page - 1) * page_size
    with engine.connect() as conn:
        total = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        rows_result = conn.execute(text(f"SELECT * FROM {table} ORDER BY 1 LIMIT {page_size} OFFSET {offset}"))
        columns = list(rows_result.keys())
        rows = [dict(zip(columns, row)) for row in rows_result.fetchall()]
        return columns, rows, total


def escape(s):
    if s is None:
        return ''
    return html.escape(str(s))


ADMIN_PAGE = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>数据库管理</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
  .layout { display: flex; min-height: 100vh; }
  .sidebar { width: 220px; background: #1e293b; color: #fff; padding: 20px 0; flex-shrink: 0; }
  .sidebar h2 { padding: 0 20px 16px; font-size: 15px; color: #94a3b8; border-bottom: 1px solid #334155; margin-bottom: 12px; }
  .sidebar a { display: block; padding: 8px 20px; color: #cbd5e1; text-decoration: none; font-size: 14px; }
  .sidebar a:hover, .sidebar a.active { background: #334155; color: #fff; }
  .sidebar a .badge { float: right; font-size: 11px; color: #64748b; }
  .main { flex: 1; padding: 24px; overflow: auto; }
  h1 { font-size: 20px; margin-bottom: 16px; color: #1e293b; }
  .topbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .topbar span { color: #64748b; font-size: 13px; white-space: nowrap; }
  .sql-form { display: flex; gap: 8px; flex: 1; }
  .sql-input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 13px; min-width: 0; }
  .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; text-decoration: none; display: inline-block; text-align: center; }
  .btn-primary { background: #3b82f6; color: #fff; }
  .btn-primary:hover { background: #2563eb; }
  .btn-success { background: #22c55e; color: #fff; }
  .btn-success:hover { background: #16a34a; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover { background: #dc2626; }
  .btn-secondary { background: #64748b; color: #fff; }
  .btn-secondary:hover { background: #475569; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .btn-xs { padding: 2px 8px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; max-width: 300px; word-break: break-all; vertical-align: top; }
  tr:hover td { background: #f8fafc; }
  .null { color: #aaa; font-style: italic; }
  .bool-true { color: #22c55e; font-weight: bold; }
  .bool-false { color: #ef4444; font-weight: bold; }
  .pager { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
  .pager a { padding: 6px 12px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; text-decoration: none; color: #374151; font-size: 13px; }
  .pager a:hover { background: #f3f4f6; }
  .msg { padding: 10px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; }
  .msg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .msg-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #1e40af; }
  .table-actions { display: flex; gap: 4px; }
  /* Edit form */
  .edit-panel { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 16px; }
  .edit-panel h2 { font-size: 16px; margin-bottom: 16px; color: #1e293b; }
  .form-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .form-label { width: 160px; font-size: 13px; color: #64748b; padding-top: 8px; text-align: right; flex-shrink: 0; }
  .form-field { flex: 1; }
  .form-field input, .form-field select, .form-field textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; }
  .form-field textarea { min-height: 80px; resize: vertical; }
  .form-field input:disabled { background: #f1f5f9; color: #94a3b8; }
  .form-actions { display: flex; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .col-actions { width: 140px; }
  /* Inline editable cells */
  td.cell-editable { cursor: pointer; }
  td.cell-editable:hover { background: #eff6ff; outline: 1px solid #bfdbfe; border-radius: 4px; }
  td.cell-saving { opacity: 0.5; }
  .cell-input { width: 100%; padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 13px; font-family: inherit; outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
  .cell-msg { position: fixed; bottom: 20px; right: 20px; padding: 10px 16px; border-radius: 6px; font-size: 13px; z-index: 100; }
  .cell-msg.ok { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .cell-msg.err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <h2>📊 数据库</h2>
    __SIDEBAR__
  </div>
  <div class="main">
    __CONTENT__
  </div>
</div>
<script>
var _table = __TABLE__, _pk = __PK__;

function showMsg(text, ok) {
  var m = document.createElement('div');
  m.className = 'cell-msg ' + (ok ? 'ok' : 'err');
  m.textContent = text;
  document.body.appendChild(m);
  setTimeout(function() { m.remove(); }, 2500);
}

function fmtVal(v) {
  if (v === null || v === undefined) return '<span class="null">NULL</span>';
  if (typeof v === 'boolean') return v ? '<span class="bool-true">✓</span>' : '<span class="bool-false">✗</span>';
  var s = String(v);
  if (s.length > 100) s = s.substring(0, 100) + '...';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function startEdit(td) {
  if (td.querySelector('input,select')) return;
  var col = td.dataset.col;
  var pkVal = td.dataset.pk;
  var oldVal = td.dataset.raw;
  var isBool = td.dataset.bool === '1';
  var isLong = String(oldVal || '').length > 100;
  var input;

  if (isBool) {
    input = document.createElement('select');
    input.className = 'cell-input';
    [1,0].forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v ? '1 / true' : '0 / false';
      if (String(oldVal) === String(v)) opt.selected = true;
      input.appendChild(opt);
    });
  } else if (isLong) {
    input = document.createElement('textarea');
    input.className = 'cell-input';
    input.value = oldVal || '';
    input.style.minHeight = '60px';
  } else {
    input = document.createElement('input');
    input.className = 'cell-input';
    input.value = oldVal || '';
  }

  td.textContent = '';
  td.appendChild(input);
  input.focus();
  if (input.select) input.select();

  function save() {
    var newVal = input.value;
    if (newVal === oldVal) { td.innerHTML = fmtVal(oldVal); return; }
    td.classList.add('cell-saving');
    td.textContent = '...';
    fetch('/api/admin/' + _table + '/cell-update', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'pk=' + encodeURIComponent(_pk) + '&pk_val=' + encodeURIComponent(pkVal) + '&col=' + encodeURIComponent(col) + '&value=' + encodeURIComponent(newVal)
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        td.classList.remove('cell-saving');
        if (d.ok) {
          td.innerHTML = fmtVal(d.value);
          td.dataset.raw = (d.value === null ? '' : String(d.value));
          showMsg('已保存', true);
        } else {
          td.innerHTML = fmtVal(oldVal);
          showMsg('保存失败: ' + d.error, false);
        }
      })
      .catch(function(e) {
        td.classList.remove('cell-saving');
        td.innerHTML = fmtVal(oldVal);
        showMsg('网络错误', false);
      });
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { td.innerHTML = fmtVal(oldVal); }
  });
}

document.addEventListener('click', function(e) {
  var td = e.target.closest('td.cell-editable');
  if (td && !td.querySelector('input,select')) startEdit(td);
});
</script>
</body>
</html>"""


def _render_table(table, cols, rows, total, page, pk_col, edit_row=None):
    page_size = 50
    total_pages = max(1, (total + page_size - 1) // page_size)
    content = f'<div class="info">{table} 表 · 共 {total} 行</div>'

    # Edit / New row form
    if edit_row is not None:
        content += '<div class="edit-panel">'
        content += f'<h2>{"编辑行" if edit_row else "新增行"}</h2>'
        content += f'<form method="post" action="/api/admin/{table}/save">'
        if edit_row:
            for c in cols:
                val = edit_row.get(c)
                val_str = '' if val is None else escape(val)
                is_pk = (c == pk_col)
                readonly = 'readonly' if is_pk else ''
                disabled = 'disabled' if is_pk else ''
                content += f'<div class="form-row">'
                content += f'<div class="form-label">{c}</div>'
                content += f'<div class="form-field">'
                if 'BOOL' in str(get_col_type(table, c)).upper():
                    checked = 'checked' if val else ''
                    content += f'<select name="f_{c}"><option value="1" {"selected" if val == 1 else ""}>1 / true</option><option value="0" {"selected" if val == 0 else ""}>0 / false</option></select>'
                else:
                    content += f'<input name="f_{c}" value="{val_str}" {readonly}>'
                if is_pk:
                    content += f'<input type="hidden" name="f_{c}" value="{val_str}">'
                content += f'</div></div>'
            content += f'<input type="hidden" name="pk" value="{pk_col}">'
            content += f'<input type="hidden" name="pk_val" value="{escape(edit_row.get(pk_col))}">'
        else:
            for c in cols:
                content += f'<div class="form-row">'
                content += f'<div class="form-label">{c}</div>'
                content += f'<div class="form-field">'
                content += f'<input name="f_{c}" value="">'
                content += f'</div></div>'
        content += '<div class="form-actions">'
        content += '<button type="submit" class="btn btn-success">💾 保存</button>'
        content += f'<a href="/api/admin?table={table}&page={page}" class="btn btn-secondary">取消</a>'
        content += '</div></form></div>'

    content += f'<div class="topbar">'
    content += f'<a href="/api/admin?table={table}&page={page}&new=1" class="btn btn-primary">➕ 新增行</a>'
    content += '</div>'

    content += '<table><tr>'
    content += '<th>操作</th>'
    for c in cols:
        content += f'<th>{c}</th>'
    content += '</tr>'

    for row in rows:
        content += '<tr>'
        content += '<td>'
        content += f'<div class="table-actions">'
        pk_val = row.get(pk_col)
        content += f'<a href="/api/admin?table={table}&page={page}&edit={escape(pk_val)}" class="btn btn-xs btn-primary">✏️</a> '
        content += f'<form method="post" action="/api/admin/{table}/delete" style="display:inline">'
        content += f'<input type="hidden" name="pk" value="{pk_col}">'
        content += f'<input type="hidden" name="pk_val" value="{escape(pk_val)}">'
        content += f'<input type="hidden" name="page" value="{page}">'
        content += f'<button type="submit" class="btn btn-xs btn-danger" onclick="return confirm(\'确定删除？\')">🗑️</button>'
        content += '</form>'
        content += '</div>'
        content += '</td>'
        for k, v in row.items():
            is_pk = (k == pk_col)
            if is_pk:
                if v is None:
                    content += '<td><span class="null">NULL</span></td>'
                else:
                    content += f'<td>{escape(v)}</td>'
            elif v is None:
                content += f'<td class="cell-editable" data-col="{escape(k)}" data-pk="{escape(pk_val)}" data-raw="" data-bool="0"><span class="null">NULL</span></td>'
            elif isinstance(v, bool):
                cls = 'bool-true' if v else 'bool-false'
                content += f'<td class="cell-editable {cls}" data-col="{escape(k)}" data-pk="{escape(pk_val)}" data-raw="{escape(v)}" data-bool="1">{"✓" if v else "✗"}</td>'
            else:
                content += f'<td class="cell-editable" data-col="{escape(k)}" data-pk="{escape(pk_val)}" data-raw="{escape(v)}" data-bool="0">{escape(v)}</td>'
        content += '</tr>'
    content += '</table>'

    if total_pages > 1:
        content += '<div class="pager">'
        if page > 1:
            content += f'<a href="/api/admin?table={table}&page={page-1}">← 上一页</a>'
        content += f'<span>第 {page} / {total_pages} 页 · 共 {total} 行</span>'
        if page < total_pages:
            content += f'<a href="/api/admin?table={table}&page={page+1}">下一页 →</a>'
        content += '</div>'
    return content


def get_col_type(table, col):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        for row in result:
            if row[1] == col:
                return row[2]
    return 'TEXT'


@router.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request, table: str = None, page: int = 1,
                       sql: str = None, msg: str = None, error: str = None,
                       edit: str = None, new: str = None):
    from middleware.auth import get_current_user_id
    user_id = get_current_user_id(request)

    tables = get_tables()
    sidebar_links = '\n'.join(
        f'<a href="/api/admin?table={t}" class="{"active" if t == table else ""}">{t} <span class="badge">{_count(t)}</span></a>'
        for t in tables
    )

    content = ""
    content += f"""
    <h1>数据库管理</h1>
    <div class="topbar">
      <form class="sql-form" method="get" action="/api/admin">
        <input name="table" value="{escape(table)}" type="hidden">
        <input name="sql" class="sql-input" placeholder="SQL（SELECT/UPDATE/DELETE/INSERT）" value="{escape(sql)}">
        <button type="submit" class="btn btn-primary">执行</button>
      </form>
    </div>"""

    if msg:
        content += f'<div class="msg msg-success">{escape(msg)}</div>'
    if error:
        content += f'<div class="msg msg-error">{escape(error)}</div>'

    if sql:
        sql = sql.strip()
        if sql.lower().startswith('select'):
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(sql))
                    cols = list(result.keys())
                    rows = result.fetchall()
                content += f'<div class="info">查询返回 {len(rows)} 行</div>'
                content += '<table><tr>'
                content += '<th></th>'
                for c in cols:
                    content += f'<th>{c}</th>'
                content += '</tr>'
                for row in rows:
                    content += '<tr><td></td>'
                    for v in row:
                        if v is None:
                            content += '<td><span class="null">NULL</span></td>'
                        elif isinstance(v, bool):
                            cls = 'bool-true' if v else 'bool-false'
                            content += f'<td class="{cls}">{"✓" if v else "✗"}</td>'
                        else:
                            content += f'<td>{escape(v)}</td>'
                    content += '</tr>'
                content += '</table>'
            except Exception as e:
                content += f'<div class="msg msg-error">SQL 错误: {escape(str(e))}</div>'
        else:
            try:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()
                content += '<div class="msg msg-success">执行成功</div>'
            except Exception as e:
                content += f'<div class="msg msg-error">执行失败: {escape(str(e))}</div>'

    elif table:
        pk_col = get_primary_key(table)
        cols, rows, total = get_table_rows(table, page)

        edit_row = None
        if edit is not None:
            pk_val = edit
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT * FROM {table} WHERE {pk_col}=:pk"), {"pk": pk_val})
                row = result.fetchone()
            if row:
                edit_row = dict(zip(cols, row))

        if new == '1':
            edit_row = {}

        content += _render_table(table, cols, rows, total, page, pk_col, edit_row)
    else:
        content += '<div class="info">← 选择左侧表名查看和管理数据</div>'

    return ADMIN_PAGE.replace('__SIDEBAR__', sidebar_links).replace('__CONTENT__', content).replace('__TABLE__', repr(table)).replace('__PK__', repr(pk_col))


@router.post("/admin/{table}/save", response_class=RedirectResponse)
async def save_row(table: str, request: Request,
                    pk: str = Form(...), pk_val: str = Form(None)):
    form = await request.form()
    fields = {k[2:]: v for k, v in form.items() if k.startswith('f_')}

    with engine.connect() as conn:
        if pk_val is not None:
            # UPDATE - use named params
            set_clause = ', '.join(f"{k}=:v{i}" for i, k in enumerate(fields) if k != pk)
            params = {f"v{i}": v for i, (k, v) in enumerate(fields.items()) if k != pk}
            params['pk'] = pk_val
            sql = f"UPDATE {table} SET {set_clause} WHERE {pk}=:pk"
            conn.execute(text(sql), params)
            conn.commit()
            msg = "更新成功"
        else:
            # INSERT - use named params
            cols = ', '.join(fields.keys())
            placeholders = ', '.join(f":v{i}" for i in range(len(fields)))
            params = {f"v{i}": v for i, v in enumerate(fields.values())}
            sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
            conn.execute(text(sql), params)
            conn.commit()
            msg = "新增成功"
    return RedirectResponse(f"/api/admin?table={table}&msg={msg}", status_code=303)


@router.post("/admin/{table}/delete", response_class=RedirectResponse)
async def delete_row(table: str, request: Request,
                     pk: str = Form(...), pk_val: str = Form(...), page: int = Form(1)):
    with engine.connect() as conn:
        conn.execute(text(f"DELETE FROM {table} WHERE {pk}=:pk"), {"pk": pk_val})
        conn.commit()
    return RedirectResponse(f"/api/admin?table={table}&page={page}&msg=删除成功", status_code=303)


@router.post("/admin/{table}/cell-update")
async def cell_update(table: str, request: Request,
                      pk: str = Form(...), pk_val: str = Form(...),
                      col: str = Form(...), value: str = Form(...)):
    from fastapi.responses import JSONResponse
    # 空字符串转 NULL
    final_val = None if value == '' else value
    try:
        with engine.connect() as conn:
            conn.execute(
                text(f"UPDATE {table} SET {col}=:val WHERE {pk}=:pk"),
                {"val": final_val, "pk": pk_val}
            )
            conn.commit()
        # 返回新值用于更新 UI
        return JSONResponse({"ok": True, "value": final_val})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


def _count(table):
    try:
        with engine.connect() as conn:
            return conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    except:
        return '?'
