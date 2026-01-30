import { useState } from 'react';
import { PersonalTab } from './components/PersonalTab';
import { TeamTab } from './components/TeamTab';

type Tab = 'personal' | 'team';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Usage Stats Dashboard</h1>
          <p className="text-gray-500 text-sm">Claude Code & Cursor 使用统计</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('personal')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'personal'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              个人统计
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              团队汇总
            </button>
          </nav>
        </div>
      </div>

      {/* Content - keep both tabs mounted to preserve state */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className={activeTab === 'personal' ? '' : 'hidden'}>
          <PersonalTab />
        </div>
        <div className={activeTab === 'team' ? '' : 'hidden'}>
          <TeamTab />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center text-gray-400 text-sm">
        Usage Stats Dashboard © 2026
      </footer>
    </div>
  );
}

export default App;
