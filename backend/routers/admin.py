from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import text, inspect
from database import engine

router = APIRouter()


def get_tables():
    """获取所有表名"""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"))
        return [row[0] for row in result]


def get_table_columns(table: str):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return [{'name': row[1], 'type': row[2]} for row in result]


def get_table_rows(table: str, page: int = 1, page_size: int = 50):
    offset = (page - 1) * page_size
    with engine.connect() as conn:
        count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
        total = count_result.scalar()
        rows_result = conn.execute(text(f"SELECT * FROM {table} ORDER BY 1 LIMIT {page_size} OFFSET {offset}"))
        columns = list(rows_result.keys())
        rows = [dict(zip(columns, row)) for row in rows_result.fetchall()]
        return columns, rows, total


TABLES_WITH_SENSITIVE = {'users', 'wrong_questions'}


def format_value(v):
    if v is None:
        return '<span style="color:#aaa">NULL</span>'
    s = str(v)
    if len(s) > 100:
        s = s[:100] + '...'
    import html
    return html.escape(s)


def render_bool(v):
    if v is None:
        return ''
    return '✓' if v else '✗'


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
  .topbar span { color: #64748b; font-size: 13px; }
  .sql-form { display: flex; gap: 8px; flex: 1; }
  .sql-input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 13px; }
  .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
  .btn-primary { background: #3b82f6; color: #fff; }
  .btn-primary:hover { background: #2563eb; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover { background: #dc2626; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
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
  .col-actions { width: 80px; }
  .col-id { width: 60px; }
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
</body>
</html>"""


@router.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request, table: str = None, page: int = 1, sql: str = None, msg: str = None, error: str = None):
    from middleware.auth import get_current_user_id
    user_id = get_current_user_id(request)

    tables = get_tables()
    sidebar_links = '\n'.join(
        f'<a href="/api/admin?table={t}" class="{"active" if t == table else ""}">{t} <span class="badge">{_count(t)}</span></a>'
        for t in tables
    )

    content = ""

    # 顶部 SQL 查询框
    content += f"""
    <h1>数据库管理</h1>
    <div class="topbar">
      <form class="sql-form" method="get" action="/api/admin">
        <input name="table" value="{table or ''}" type="hidden">
        <input name="sql" class="sql-input" placeholder="输入 SQL 语句（SELECT/UPDATE/DELETE），回车执行" value="{sql or ''}">
        <button type="submit" class="btn btn-primary">执行</button>
      </form>
      <span>仅 SELECT 可查询结果，其他语句直接执行</span>
    </div>"""

    if msg:
        content += f'<div class="msg msg-success">{msg}</div>'
    if error:
        content += f'<div class="msg msg-error">{error}</div>'

    # 执行 SQL
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
                    for c in cols:
                        content += f'<th>{c}</th>'
                    content += '</tr>'
                    for row in rows:
                        content += '<tr>'
                        for v in row:
                            if v is None:
                                content += '<td><span class="null">NULL</span></td>'
                            elif isinstance(v, bool):
                                cls = 'bool-true' if v else 'bool-false'
                                content += f'<td class="{cls}">{"✓" if v else "✗"}</td>'
                            else:
                                content += f'<td>{format_value(v)}</td>'
                        content += '</tr>'
                    content += '</table>'
            except Exception as e:
                content += f'<div class="msg msg-error">SQL 错误: {e}</div>'
        else:
            try:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()
                count = conn.execute(text("SELECT ROW_COUNT()")).scalar()
                content += f'<div class="msg msg-success">执行成功，影响行数（估计）: ~{count}</div>'
            except Exception as e:
                content += f'<div class="msg msg-error">执行失败: {e}</div>'

    # 显示表内容
    elif table:
        cols, rows, total = get_table_rows(table, page)
        page_size = 50
        total_pages = max(1, (total + page_size - 1) // page_size)

        content += f'<div class="info">{table} 表 · 共 {total} 行</div>'
        content += '<table><tr>'
        for c in cols:
            content += f'<th>{c}</th>'
        content += '</tr>'
        for row in rows:
            content += '<tr>'
            for k, v in row.items():
                if v is None:
                    content += '<td><span class="null">NULL</span></td>'
                elif isinstance(v, bool):
                    cls = 'bool-true' if v else 'bool-false'
                    content += f'<td class="{cls}">{"✓" if v else "✗"}</td>'
                else:
                    content += f'<td>{format_value(v)}</td>'
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
    else:
        content += '<div class="info">← 选择左侧表名查看数据，或输入 SQL 直接查询</div>'

    return ADMIN_PAGE.replace('__SIDEBAR__', sidebar_links).replace('__CONTENT__', content)


def _count(table):
    try:
        with engine.connect() as conn:
            return conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    except:
        return '?'
