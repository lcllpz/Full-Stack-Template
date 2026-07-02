import {
  HttpStatus,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipeOptions,
} from '@nestjs/common';

// 生成错误信息
function generateErrors(errors: ValidationError[]) {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrors(currentValue.children ?? [])
          : Object.values(currentValue.constraints ?? {}),
    }),
    {},
  );
}

// 错误处理与统一响应： 验证选项
const validationOptions: ValidationPipeOptions = {
  whitelist: true, // 静默删掉 DTO 里没有的字段，只把合法字段交给 Controller
  transform: true, // 自动转成 DTO 实例
  forbidNonWhitelisted: true, // 一旦发现多余字段，直接报错，请求不会进入 Controller
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) => {
    console.log(errors);
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: generateErrors(errors),
    });
  },
};

export default validationOptions;
