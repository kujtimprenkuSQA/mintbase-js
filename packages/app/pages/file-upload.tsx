import { NextPage } from 'next';
import React, { useState } from 'react';
import styles from '../styles/Home.module.css';
import { uploadFile } from '@mintbase-js/storage';

const FileUpload: NextPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (!file) {
      return;
    }

    const uploadResult = await uploadFile(file);
    setResult(uploadResult);
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={handleChange} />
        <button type="submit">Upload</button>
      </form>
      {result && (
        <div>
          <a href={`https://arweave.net/${result?.id}`}>File ({result?.id})</a>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
