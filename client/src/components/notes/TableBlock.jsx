export default function TableBlock({ headers = [], rows = [] }) {
  if (!headers || headers.length === 0) return null;
  return (
    <div className="note-block-table-wrap">
      <table className="note-block-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {(row?.cells || []).map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
