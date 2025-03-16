# ICPC Training Timer

A specialized timer application designed for ICPC (International Collegiate Programming Contest) team practice sessions. This tool helps teams track and analyze how members spend their time during practice contests.

## Features

### Team Management
- Supports a team of three members (configurable)
- Tracks individual member activities
- Persistent state across browser sessions

### Problem Tracking
- Configurable number of problems (A, B, C, etc.)
- Status tracking for each problem (unsolved/solved)
- Accumulated time tracking per problem

### Activity States
For each problem, members can be in one of three states:
- **Idle**: Not working on any problem
- **Solving**: Reading and solving the problem
- **Coding**: Implementing the solution

### Time Tracking
- Individual timers for each member-problem combination
- Accumulated time for each state
- Total time spent per problem across all team members
- Idle time tracking per member
- All timers persist across page refreshes

### Session Management
- Start/Pause functionality for the entire session
- Problem completion tracking
- Activity log with timestamped events
- Restart capability with confirmation

## Usage

1. **Initial Setup**
   - Enter the number of problems for the practice session
   - Click "Confirm" to lock in the problem count

2. **During Practice**
   - Use the "Start/Pause" button to control the session timer
   - Select member activities using radio buttons:
     - Left column: Idle state
     - Problem columns: Solve/Code states
   - Mark problems as solved using checkboxes in problem headers

3. **Monitoring**
   - View accumulated time for each member-problem combination
   - Track total time spent per problem in column headers
   - Monitor idle time for each team member
   - Review activity log for session history

4. **Session Reset**
   - Use the "Restart" button to reset all data
   - Confirmation required to prevent accidental resets

## Implementation Details

- Built with React and TypeScript
- Uses localStorage for state persistence
- Responsive design for various screen sizes
- Monospace font for consistent timer display

## Purpose

This application helps ICPC teams:
- Analyze time distribution across problems
- Track individual member contributions
- Identify patterns in problem-solving approach
- Improve team coordination and efficiency
- Maintain accurate records of practice sessions
