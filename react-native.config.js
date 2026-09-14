// react-native-pdf-thumbnail declara namespace "com.pdfthumbnail" mas o código vive em org.songsterq.pdfthumbnail.
module.exports = {
  dependencies: {
    'react-native-pdf-thumbnail': {
      platforms: {
        android: {
          packageImportPath: 'import org.songsterq.pdfthumbnail.PdfThumbnailPackage;',
          packageInstance: 'new PdfThumbnailPackage()',
        },
      },
    },
  },
};
