import { useState, useEffect, useCallback } from 'react';

interface MemberAction {
  action: 'idle' | 'solve' | 'code';
  problem?: string;
}

interface TeamActions {
  [key: string]: MemberAction;
}

interface ProblemStates {
  [key: string]: boolean;
}

const TEAM_MEMBERS = ['TG', 'BJ', 'SR'];
const ACTIONS: ('idle' | 'solve' | 'code')[] = ['idle', 'solve', 'code'];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function App() {
  const [numProblems, setNumProblems] = useState<number | ''>('');
  const [isNumProblemsLocked, setIsNumProblemsLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [teamActions, setTeamActions] = useState<TeamActions>({
    TG: { action: 'idle' },
    BJ: { action: 'idle' },
    SR: { action: 'idle' },
  });
  const [problemStates, setProblemStates] = useState<ProblemStates>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [showDialog, setShowDialog] = useState<string | null>(null);

  // Timer effect
  useEffect(() => {
    let intervalId: number;
    if (isRunning) {
      intervalId = window.setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  // Initialize problem states when number of problems is locked
  useEffect(() => {
    if (isNumProblemsLocked && typeof numProblems === 'number') {
      const problems: ProblemStates = {};
      Array.from({ length: numProblems }, (_, i) => {
        problems[String.fromCharCode(65 + i)] = false;
      });
      setProblemStates(problems);
    }
  }, [isNumProblemsLocked, numProblems]);

  const addLog = useCallback((message: string) => {
    setLogs((prevLogs) => [...prevLogs, `${formatTime(time)} ${message}`]);
  }, [time]);

  const handleNumProblemsSubmit = () => {
    if (numProblems !== '' && numProblems > 0) {
      setIsNumProblemsLocked(true);
    }
  };

  const handleActionChange = (member: string, action: 'idle' | 'solve' | 'code', problem?: string) => {
    if (!isRunning) return;

    setTeamActions((prev) => ({
      ...prev,
      [member]: { action, ...(problem ? { problem } : {}) },
    }));

    if (action === 'idle') {
      addLog(`${member} is idle`);
    } else {
      addLog(`${member} ${action}s problem ${problem}`);
    }
  };

  const handleProblemSolved = (problem: string) => {
    if (!isRunning) return;

    setProblemStates((prev) => ({ ...prev, [problem]: true }));
    addLog(`problem ${problem} solved.`);

    // Reset members working on this problem to idle
    setTeamActions((prev) => {
      const newState = { ...prev };
      TEAM_MEMBERS.forEach((member) => {
        if (prev[member].problem === problem) {
          newState[member] = { action: 'idle' };
          addLog(`${member} is idle`);
        }
      });
      return newState;
    });
  };

  return (
    <main className="container">
      <article>
        <header>
          <h1>ICPC Team Tracker</h1>
        </header>

        {/* Problem count input */}
        <div className="grid">
          <div>
            <label>
              Number of Problems:
              <input
                type="number"
                min="1"
                value={numProblems}
                onChange={(e) => setNumProblems(parseInt(e.target.value) || '')}
                disabled={isNumProblemsLocked}
              />
            </label>
            {!isNumProblemsLocked && (
              <button onClick={handleNumProblemsSubmit}>Confirm</button>
            )}
          </div>
        </div>

        {/* Timer */}
        <div className="grid">
          <div>
            <h2>{formatTime(time)}</h2>
            <button onClick={() => setIsRunning(!isRunning)}>
              {isRunning ? 'Pause' : 'Start'}
            </button>
          </div>
        </div>

        {/* Team status table */}
        {isNumProblemsLocked && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Members</th>
                  <th>Idle</th>
                  {Object.keys(problemStates).map((problem) => (
                    <th key={problem}>
                      {problem}
                      <br />
                      <label>
                        <input
                          type="checkbox"
                          checked={problemStates[problem]}
                          onChange={() => setShowDialog(problem)}
                          disabled={!isRunning || problemStates[problem]}
                        />
                        Solved
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEAM_MEMBERS.map((member) => (
                  <tr key={member}>
                    <td>{member}</td>
                    <td>
                      <input
                        type="radio"
                        checked={teamActions[member].action === 'idle'}
                        onChange={() => handleActionChange(member, 'idle')}
                        disabled={!isRunning}
                      />
                    </td>
                    {Object.keys(problemStates).map((problem) => (
                      <td key={problem}>
                        {!problemStates[problem] && (
                          <div>
                            <div>
                              <input
                                type="radio"
                                checked={
                                  teamActions[member].action === 'solve' &&
                                  teamActions[member].problem === problem
                                }
                                onChange={() => handleActionChange(member, 'solve', problem)}
                                disabled={!isRunning}
                              />
                              Solve
                            </div>
                            <div>
                              <input
                                type="radio"
                                checked={
                                  teamActions[member].action === 'code' &&
                                  teamActions[member].problem === problem
                                }
                                onChange={() => handleActionChange(member, 'code', problem)}
                                disabled={!isRunning}
                              />
                              Code
                            </div>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showDialog && (
          <dialog open>
            <article>
              <h3>Confirm Problem Solved</h3>
              <p>Are you sure problem {showDialog} is solved?</p>
              <footer>
                <button onClick={() => {
                  handleProblemSolved(showDialog);
                  setShowDialog(null);
                }}>
                  Yes
                </button>
                <button onClick={() => setShowDialog(null)}>No</button>
              </footer>
            </article>
          </dialog>
        )}

        {/* Logs */}
        <div style={{ 
          marginTop: '2rem',
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid var(--primary)',
          padding: '1rem',
          borderRadius: '4px'
        }}>
          <h3>Activity Log</h3>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </article>
    </main>
  );
}

export default App;
