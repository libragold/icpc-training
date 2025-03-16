import { useState, useEffect, useCallback } from 'react';

interface MemberAction {
  action: 'idle' | 'solve' | 'code';
  problem?: string;
  startTime?: number;  // timestamp when the action started
}

interface TeamActions {
  [key: string]: MemberAction;
}

interface ProblemStates {
  [key: string]: boolean;
}

const TEAM_MEMBERS = ['TG', 'BJ', 'SR'];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatMMSS(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function App() {
  const [numProblems, setNumProblems] = useState<number | ''>(() => {
    const saved = localStorage.getItem('numProblems');
    return saved ? parseInt(saved) : '';
  });
  const [isNumProblemsLocked, setIsNumProblemsLocked] = useState(() => {
    return localStorage.getItem('isNumProblemsLocked') === 'true';
  });
  const [time, setTime] = useState(() => {
    const saved = localStorage.getItem('time');
    return saved ? parseInt(saved) : 0;
  });
  const [isRunning, setIsRunning] = useState(() => {
    return localStorage.getItem('isRunning') === 'true';
  });
  const [teamActions, setTeamActions] = useState<TeamActions>(() => {
    const saved = localStorage.getItem('teamActions');
    return saved ? JSON.parse(saved) : {
      TG: { action: 'idle' },
      BJ: { action: 'idle' },
      SR: { action: 'idle' },
    };
  });
  const [problemStates, setProblemStates] = useState<ProblemStates>(() => {
    const saved = localStorage.getItem('problemStates');
    return saved ? JSON.parse(saved) : {};
  });
  const [logs, setLogs] = useState<string[]>(() => {
    const saved = localStorage.getItem('logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [showDialog, setShowDialog] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [actionTimers, setActionTimers] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('actionTimers');
    return saved ? JSON.parse(saved) : {};
  });

  // Save states to localStorage whenever they change
  useEffect(() => {
    if (numProblems !== '') {
      localStorage.setItem('numProblems', String(numProblems));
    }
  }, [numProblems]);

  useEffect(() => {
    localStorage.setItem('isNumProblemsLocked', String(isNumProblemsLocked));
  }, [isNumProblemsLocked]);

  useEffect(() => {
    localStorage.setItem('time', String(time));
  }, [time]);

  useEffect(() => {
    localStorage.setItem('isRunning', String(isRunning));
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('teamActions', JSON.stringify(teamActions));
  }, [teamActions]);

  useEffect(() => {
    localStorage.setItem('problemStates', JSON.stringify(problemStates));
  }, [problemStates]);

  useEffect(() => {
    localStorage.setItem('logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('actionTimers', JSON.stringify(actionTimers));
  }, [actionTimers]);

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
      setProblemStates(prev => {
        const problems: ProblemStates = {};
        Array.from({ length: numProblems }, (_, i) => {
          const problem = String.fromCharCode(65 + i);
          // Preserve the solved state if it exists, otherwise initialize to false
          problems[problem] = prev[problem] || false;
        });
        return problems;
      });

      // Initialize timers only for new problems/members while preserving existing values
      setActionTimers(prev => {
        const newTimers = { ...prev };
        TEAM_MEMBERS.forEach(member => {
          // Initialize idle timer if not exists
          if (!(`${member}-idle` in newTimers)) {
            newTimers[`${member}-idle`] = 0;
          }
          // Initialize problem timers if not exists
          Array.from({ length: numProblems }, (_, i) => {
            const problem = String.fromCharCode(65 + i);
            const key = `${member}-${problem}`;
            if (!(key in newTimers)) {
              newTimers[key] = 0;
            }
          });
        });
        return newTimers;
      });
    }
  }, [isNumProblemsLocked, numProblems]);

  // Update timers for all states (idle and active)
  useEffect(() => {
    let intervalId: number;
    if (isRunning) {
      intervalId = window.setInterval(() => {
        setActionTimers(prev => {
          const newTimers = { ...prev };
          // Update timers for all members
          TEAM_MEMBERS.forEach(member => {
            const action = teamActions[member];
            if (action.action === 'idle') {
              // Increment idle timer
              const idleKey = `${member}-idle`;
              if (idleKey in newTimers) {
                newTimers[idleKey] = newTimers[idleKey] + 1;
              }
            } else if (action.problem) {
              // Increment problem timer
              const timerKey = `${member}-${action.problem}`;
              if (timerKey in newTimers) {
                newTimers[timerKey] = newTimers[timerKey] + 1;
              }
            }
          });
          return newTimers;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, teamActions]);

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
      [member]: { 
        action, 
        ...(problem ? { problem } : {})
      },
    }));

    if (action === 'idle') {
      addLog(`${member} is now idle.`);
    } else if (action === 'solve') {
      addLog(`${member} starts working on Problem ${problem}.`);
    } else if (action === 'code') {
      addLog(`${member} begins coding for Problem ${problem}.`);
    }
  };

  const handleProblemSolved = (problem: string) => {
    if (!isRunning) return;

    setProblemStates((prev) => ({ ...prev, [problem]: true }));
    addLog(`Problem ${problem} is successfully solved.`);

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

  // Add reset function
  const handleReset = () => {
    // Reset all localStorage items
    localStorage.removeItem('numProblems');
    localStorage.removeItem('isNumProblemsLocked');
    localStorage.removeItem('time');
    localStorage.removeItem('isRunning');
    localStorage.removeItem('teamActions');
    localStorage.removeItem('problemStates');
    localStorage.removeItem('logs');
    localStorage.removeItem('actionTimers');

    // Reset all state
    setNumProblems('');
    setIsNumProblemsLocked(false);
    setTime(0);
    setIsRunning(false);
    setTeamActions({
      TG: { action: 'idle' },
      BJ: { action: 'idle' },
      SR: { action: 'idle' },
    });
    setProblemStates({});
    setLogs([]);
    setShowResetDialog(false);
    setActionTimers({});
  };

  return (
    <main>
      <article>
        {/* Problem count input */}
        <div className="grid">
          { !isNumProblemsLocked &&
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
          </div>}
        </div>

        { isNumProblemsLocked && 
        <>
          <div style={{ float: 'right' }}>
            <button onClick={() => setIsRunning(!isRunning)}>
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button 
              onClick={() => setShowResetDialog(true)}
              style={{ 
                backgroundColor: '#dc3545',
                borderColor: '#dc3545',
                color: 'white',
                marginLeft: '0.75rem'
              }}
            >
              Restart
            </button>
          </div>
          <h2 style={{ float: 'left', fontFamily: 'monospace' }}>{formatTime(time)}</h2>
          <div className="overflow-auto" style={{ clear: 'both' }}>
            <table style={{ fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  <th></th>
                  <th>
                    Idle
                    <div style={{ 
                      fontSize: '0.9em', 
                      color: 'var(--primary)',
                      opacity: TEAM_MEMBERS.reduce((acc, member) => acc + (actionTimers[`${member}-idle`] || 0), 0) > 0 ? 1 : 0.3 
                    }}>
                      {formatMMSS(TEAM_MEMBERS.reduce((acc, member) => acc + (actionTimers[`${member}-idle`] || 0), 0))}
                    </div>
                  </th>
                  {Object.keys(problemStates).map((problem) => (
                    <th key={problem}>
                      {problem}
                      <input
                        type="checkbox"
                        checked={problemStates[problem]}
                        onChange={() => setShowDialog(problem)}
                        disabled={!isRunning || problemStates[problem]}
                      />
                      {(() => {
                        const sum = TEAM_MEMBERS.reduce((acc, member) => 
                          acc + (actionTimers[`${member}-${problem}`] || 0), 0);
                        return (
                          <div style={{ 
                            fontSize: '0.9em', 
                            color: 'var(--primary)',
                            opacity: sum > 0 ? 1 : 0.3 
                          }}>
                            {formatMMSS(sum)}
                          </div>
                        );
                      })()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEAM_MEMBERS.map((member) => (
                  <tr key={member}>
                    <td>{member}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0rem', marginTop: '0.3rem' }}>
                        <input
                          type="radio"
                          checked={teamActions[member].action === 'idle'}
                          onChange={() => handleActionChange(member, 'idle')}
                          disabled={!isRunning}
                        />
                        <div style={{ 
                          fontSize: '0.9em', 
                          color: 'var(--primary)',
                          opacity: (actionTimers[`${member}-idle`] || 0) > 0 ? 1 : 0.3 
                        }}>
                          {formatMMSS(actionTimers[`${member}-idle`] || 0)}
                        </div>
                      </div>
                    </td>
                    {Object.keys(problemStates).map((problem) => (
                      <td key={problem}>
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '0rem', marginTop: '0.3rem' }}>
                        <input
                          type="radio"
                          checked={
                            teamActions[member].action === 'solve' &&
                            teamActions[member].problem === problem
                          }
                          onChange={() => handleActionChange(member, 'solve', problem)}
                          disabled={!isRunning || problemStates[problem]}
                          style={{ marginRight: '0.25rem' }}
                        />
                        <input
                          type="radio"
                          checked={
                            teamActions[member].action === 'code' &&
                            teamActions[member].problem === problem
                          }
                          onChange={() => handleActionChange(member, 'code', problem)}
                          disabled={!isRunning || problemStates[problem]}
                        />
                        </div>
                        <div style={{ 
                          fontSize: '0.9em', 
                          color: 'var(--primary)', 
                          textAlign: 'center',
                          opacity: (actionTimers[`${member}-${problem}`] || 0) > 0 ? 1 : 0.3 
                        }}>
                          {formatMMSS(actionTimers[`${member}-${problem}`] || 0)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && <div>
            <h4>Logs</h4>
            <div style={{ fontFamily: 'monospace' }}>
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>}
        </>
        }

        {/* Reset Confirmation Dialog */}
        {showResetDialog && (
          <dialog open>
            <article>
              <header>
                <h3>Restart Confirmation</h3>
              </header>
              <p>Are you sure you want to restart? This action cannot be undone.</p>
              <footer>
                <button 
                  onClick={handleReset}
                  style={{ 
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545',
                    color: 'white'
                  }}
                >
                  Restart
                </button>
                <button onClick={() => setShowResetDialog(false)}>Cancel</button>
              </footer>
            </article>
          </dialog>
        )}

        {/* Original Problem Solved Dialog */}
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
      </article>
    </main>
  );
}

export default App;
