import React from 'react';
import Form from './components/Form'; 
import NotificationBar from './components/NotificationSection'; 

function App() {
  return (
    <div className="App">
      <h1>React Form with S3 File Upload</h1>
      <Form />
      <NotificationBar />
    </div>
  );
}

export default App;
