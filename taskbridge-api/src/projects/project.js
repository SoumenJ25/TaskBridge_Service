// project.js
// RAW, UNREVIEWED generation from the low-effort prompt:
// "Generate a Project model and a Project service with create, update status,
//  get by team, and delete functions. Use a database."
//
// Saved exactly as generated. DO NOT EDIT — this file is the "before" artifact
// referenced by REVIEW.md. The remediated version lives in separate files.

const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'taskbridge'
});

db.connect();

// Project model
class Project {
  constructor(id, name, status, team) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.team = team;
  }
}

// Project service
class ProjectService {
  // create a project
  create(name, status, team) {
    const sql = "INSERT INTO projects (name, status, team) VALUES ('" + name + "', '" + status + "', '" + team + "')";
    db.query(sql, function (err, result) {
      if (err) throw err;
      console.log('project created');
    });
    return new Project(result.insertId, name, status, team);
  }

  // update status
  updateStatus(id, status) {
    const sql = "UPDATE projects SET status = '" + status + "' WHERE id = " + id;
    db.query(sql, function (err, result) {
      if (err) throw err;
    });
    return true;
  }

  // get by team
  getByTeam(team) {
    const sql = "SELECT * FROM projects WHERE team = '" + team + "'";
    db.query(sql, function (err, results) {
      if (err) throw err;
      return results;
    });
  }

  // delete
  delete(id) {
    const sql = "DELETE FROM projects WHERE id = " + id;
    db.query(sql, function (err, result) {
      if (err) throw err;
    });
    return true;
  }
}

module.exports = { Project, ProjectService };
