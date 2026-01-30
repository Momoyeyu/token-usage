# Usage Stats Dashboard

团队从 Cursor 迁移到 Claude Code 的使用统计工具。

## 功能

- **个人模式**: 上传 Cursor CSV，一键对比 Claude Code 使用情况
- **团队模式**: 批量导入成员数据，生成团队汇总报告
- **趋势图表**: 每日 Token 使用量折线图
- **Markdown 导出**: 按模板生成可分享的报告

## 项目结构

```
summary/
├── backend/           # Python 后端 (FastAPI)
│   ├── app/           # API 应用
│   └── scripts/       # 统计脚本
├── frontend/          # React 前端 (Vite)
└── output/            # 数据输出
```

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 统计脚本（命令行）

```bash
# Claude Code 统计
python backend/scripts/claude_code_stats.py --week

# Cursor CSV 解析
python backend/scripts/cursor_stats.py output/*.csv

# 团队汇总
python backend/scripts/team_summary.py output/personal/*.json
```

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Recharts
- **后端**: FastAPI + Python 3.11+
- **数据源**: Claude Code 本地数据 + Cursor CSV
