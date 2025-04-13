export const filterObj = (obj, ...allowedFields) => {
  const filteredObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) {
      filteredObj[el] = obj[el];
    }
  });
  return filteredObj;
};